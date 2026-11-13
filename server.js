const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const twilio = require('twilio');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Murya Call Backend & Billing System is running!');
});
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;



let clients = {};
global.otpStorage = {};

// Lambobin PIN na Gwaji da adadin kuɗinsu
let validPins = {
  "1111222233": 100,  // PIN na ₦100 (Minti 5)
  "4444555566": 200,  // PIN na ₦200 (Minti 10)
  "7777888899": 500,  // PIN na ₦500 (Minti 25)
  "1010202030": 1000  // PIN na ₦1,000 (Minti 50)
};

wss.on('connection', (ws) => {
  let userNumber = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      // Tura OTP zuwa SIM ta Twilio
      if (data.type === 'send-otp') {
        const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
        global.otpStorage[data.phone] = otpCode;

        try {
          await twilioClient.messages.create({
            body: `Lambar tabbatarwarku ta Murya Call ita ce: ${otpCode}`,
            from: twilioPhoneNumber,
            to: data.phone
          });
          ws.send(JSON.stringify({ type: 'otp-sent', message: 'An tura lambar OTP zuwa lambarka ta SIM!' }));
        } catch (err) {
          console.error(err);
          ws.send(JSON.stringify({ type: 'otp-error', message: 'Kuskure wajen tura sakon OTP ta Twilio.' }));
        }
      }

      // Tabbatar da OTP da mai amfani ya saka
      if (data.type === 'verify-otp') {
        if (global.otpStorage[data.phone] && global.otpStorage[data.phone] === data.otp) {
          ws.send(JSON.stringify({ type: 'otp-verified' }));
        } else {
          ws.send(JSON.stringify({ type: 'otp-error', message: 'Lambar OTP ba daidai ba ce!' }));
        }
      }

      // Rijistar Mai Amfani a WebSocket
      if (data.type === 'register') {
        userNumber = data.customNumber;
        clients[userNumber] = ws;
      }

      // Tabbatar da PIN na OPay / Voucher
      if (data.type === 'redeem-pin') {
        const pin = data.pin;
        if (validPins[pin]) {
          const amount = validPins[pin];
          ws.send(JSON.stringify({ type: 'pin-success', amount: amount }));
          delete validPins[pin];
        } else {
          ws.send(JSON.stringify({ type: 'pin-error', message: 'Lambar PIN ba ta da aiki ko an riga an yi amfani da ita!' }));
        }
      }

      // Tsarin Kira (WebRTC Signaling)
      if (data.type === 'offer' || data.type === 'answer' || data.type === 'ice-candidate') {
        const targetClient = clients[data.target];
        if (targetClient && targetClient.readyState === WebSocket.OPEN) {
          targetClient.send(JSON.stringify(data));
        }
      }

    } catch (e) {
      console.error(e);
    }
  });

  ws.on('close', () => {
    if (userNumber && clients[userNumber]) {
      delete clients[userNumber];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
