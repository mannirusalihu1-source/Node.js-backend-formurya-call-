
const express = require('express');
const http = require('http');
const { Server } = require('ws');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const server = http.createServer(app);
const wss = new Server({ server });

let users = {}; // Ajiye mai amfani da WebSocket dinsa
let wallets = { "07060838340": 100 }; // Ajiyar kudin wallet

const atUsername = (process.env.AT_USERNAME || '').trim();
const atApiKey = (process.env.AT_API_KEY || '').trim();
const atCallerId = (process.env.AT_CALLER_ID || '').trim();


function normalizePhoneE164(num) {
  const clean = String(num || '').trim().replace(/\s+/g, '');
  if (!clean) return '';
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('234')) return '+' + clean;
  if (clean.startsWith('0')) return '+234' + clean.slice(1);
  return '+234' + clean;
}

async function placeAfricaTalkingCall(toNumber) {
  if (!atUsername || !atApiKey) {
    throw new Error("Ba a saita AT_USERNAME ko AT_API_KEY a Render ba.");
  }

  const normalizedTo = normalizePhoneE164(toNumber);
  if (!normalizedTo) {
    throw new Error("Babu lambar waya mai inganci.");
  }

  
  const effectiveCallerId = atCallerId || '+2347013833786';
  const normalizedFrom = normalizePhoneE164(effectiveCallerId);
  if (!normalizedFrom) {
    throw new Error("Ba a saita AT_CALLER_ID a Render ba.");
  }

  const isSandbox = atUsername === 'sandbox';
  const endpoint = isSandbox
    ? 'https://voice.sandbox.africastalking.com/call'
    : 'https://voice.africastalking.com/call';

  const params = new URLSearchParams({
    username: atUsername,
    from: normalizedFrom,
    to: normalizedTo
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'apiKey': atApiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: params.toString()
  });

  const rawText = await response.text();
  console.log('AT DEBUG:', {
    endpoint,
    params: params.toString(),
    status: response.status,
    rawText
  });

  if (!response.ok) {
    console.error('AT Error:', response.status, rawText);
    throw new Error(`Africa's Talking (${response.status}): ${rawText}`);
  }

  try {
    return rawText ? JSON.parse(rawText) : {};
  } catch (_) {
    return { raw: rawText };
  }
}

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
        wallets[ph] = wallets[ph] !== undefined ? wallets[ph] : 100;

        ws.send(JSON.stringify({
          action: 'registered',
          phone: ph,
          balance: wallets[ph]
        }));
      } else if (data.action === 'make_call' || data.action === 'call') {
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

        try {
          const atResult = await placeAfricaTalkingCall(targetNum);
          wallets[caller] = Math.max(0, (wallets[caller] || 0) - 20);

          ws.send(JSON.stringify({
            action: 'balance-update',
            newBalance: wallets[caller]
          }));

          ws.send(JSON.stringify({
            action: 'call_initiated',
            provider: 'africas_talking',
            data: atResult,
            to: targetNum
          }));
        } catch (err) {
          console.log("Kuskuren Africa's Talking (WS):", err.message);
          ws.send(JSON.stringify({
            action: 'error',
            message: err.message || "An samu kuskure wajen fara kira."
          }));
        }
        return;
      } else if (data.action === 'call-request') {
        let caller = data.callerNumber;
        let recv = data.receiverNumber;

        if ((wallets[caller] || 0) < 20) {
          ws.send(JSON.stringify({ action: 'error', message: 'Kudi sun kare a wallet dinka.' }));
          return;
        }

        if (users[recv]) {
          wallets[caller] = Math.max(0, (wallets[caller] || 0) - 20);
          ws.send(JSON.stringify({
            action: 'balance-update',
            newBalance: wallets[caller]
          }));

          // Sanar da wanda ake kira cewa ana kiransa
          users[recv].send(JSON.stringify({
            action: 'incoming_call',
            callerNumber: caller,
            signalData: data.signalData
          }));
        } else {
          ws.send(JSON.stringify({
            action: 'error',
            message: 'Wannan lamba bata kan layin yanar gizo a yanzu.'
          }));
        }
      } else if (data.action === 'signal') {
        // Aika sakonni tsakanin masu kira (Signaling)
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
    if (!recipient) {
      return res.status(400).json({
        success: false,
        message: 'Babu lambar mai karba.'
      });
    }

    const result = await placeAfricaTalkingCall(recipient);
    res.json({
      success: true,
      message: 'An fara kiran layin a waje.',
      callData: result
    });
  } catch (error) {
    console.error('Kuskuren kira:', error);
    res.status(500).json({
      success: false,
      message: error.message || "An samu kuskure wajen fara kiran Africa's Talking."
    });
  }
});

app.get('/', (req, res) => {
  res.send("Murya Call Backend na aiki da Africa's Talking.");
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
