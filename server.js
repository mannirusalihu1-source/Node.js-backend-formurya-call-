const express = require('express');
const http = require('http');
const { Server } = require('ws');
const bodyParser = require('body-parser');
const cors = require('cors');
const twilio = require('twilio');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const server = http.createServer(app);
const wss = new Server({ server });

// Haɗin Twilio daga Environment Variables na Render
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const client = (accountSid && authToken) ? twilio(accountSid, authToken) : null;

let users = {}; // Ajiye mai amfani da WebSocket dinsa
let wallets = { "07060838340": 100 }; // Ajiyar kudin wallet

wss.on('connection', (ws) => {
  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg);

      // Lokacin da mai amfani ya shiga app
      if (data.action === 'register') {
        let ph = data.phone ? data.phone.trim() : '07060838340';
        ws.phone = ph;
        users[ph] = ws;

        // Anan muka adana lambar mai amfani daidai!
        wallets[ph] = wallets[ph] || 100;

        ws.send(JSON.stringify({
          action: 'registered',
          phone: ph,
          balance: wallets[ph]
        }));
      }
else if (data.action === 'make_call' || data.action === 'call') {
  const caller = data.caller || data.from || ws.phone || '07060838340';
  const targetNum = data.target || data.to;

  if (!targetNum) {
    ws.send(JSON.stringify({ action: 'error', message: 'Babu lambar da za a kira.' }));
    return;
  }

  if ((wallets[caller] || 0) < 20) {
    ws.send(JSON.stringify({ action: 'error', message: 'Kudi sun kare a wallet dinka.' }));
    return;
  }

  if (!client || !twilioPhone) {
    ws.send(JSON.stringify({
      action: 'error',
      message: 'Ba a saita TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, ko TWILIO_PHONE_NUMBER a Render ba.'
    }));
    return;
  }

  const call = await client.calls.create({
    to: targetNum,
    from: twilioPhone,
    twiml: '<Response><Say voice="alice">Sannu, wannan kira ne daga Murya Call.</Say></Response>'
  });

  wallets[caller] -= 20;
  ws.send(JSON.stringify({
    action: 'balance-update',
    newBalance: wallets[caller]
  }));

  ws.send(JSON.stringify({
    action: 'call_initiated',
    callSid: call.sid,
    to: targetNum
  }));
}

      

      // Lokacin da aka tura bukatar kira ta cikin app (WebRTC)
      else if (data.action === 'call-request') {
        let caller = data.callerNumber;
        let recv = data.receiverNumber;

        if ((wallets[caller] || 0) < 20) {
          ws.send(JSON.stringify({ action: 'error', message: 'Kudi sun kare a wallet dinka.' }));
          return;
        }

        if (users[recv]) {
          wallets[caller] -= 20;
          ws.send(JSON.stringify({ action: 'balance-update', newBalance: wallets[caller] }));

          // Sanar da wanda ake kira cewa ana kiransa
          users[recv].send(JSON.stringify({
            action: 'incoming_call',
            callerNumber: caller,
            signalData: data.signalData
          }));
        } else {
          ws.send(JSON.stringify({ action: 'error', message: 'Wannan lamba bata kan layin yanar gizo a yanzu.' }));
        }
      }

      // Aika sakonni tsakanin masu kira (Signaling)
      else if (data.action === 'signal') {
        if (users[data.targetId]) {
          users[data.targetId].send(JSON.stringify({
            action: 'signal',
            signalData: data.signalData,
            senderId: data.senderId
          }));
        }
      }
    } catch (e) {
      console.log('Kuskure:', e);
      ws.send(JSON.stringify({ action: 'error', message: e.message || 'Kuskure a sabar.' }));
    }
  });

  ws.on('close', () => {
    if (ws.phone) {
      delete users[ws.phone];
    }
  });
});

// Express POST API don ainihin kiran waje
app.post('/make-call', async (req, res) => {
  const { caller, recipient } = req.body;
  console.log(`An karbi bukatar kira daga ${caller} zuwa ga ${recipient}`);

  try {
    if (!client || !twilioPhone || !recipient) {
      return res.status(400).json({ success: false, message: 'Babu isassun bayanan Twilio ko lambar mai karba.' });
    }

    const call = await client.calls.create({
      to: recipient,
      from: twilioPhone,
      twiml: '<Response><Say voice="alice">Sannu, wannan kira ne daga Murya Call.</Say></Response>'
    });

    res.json({
      success: true,
      message: 'An fara kiran layin a waje.',
      callSid: call.sid
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
