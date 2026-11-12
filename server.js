const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Murya Call Backend & Billing System is running!');
});

let clients = {};

// Lambobin PIN na Gwaji da adadin kuɗinsu
let validPins = {
  "1111222233": 100,   // PIN na ₦100 (Minti 5)
  "4444555566": 200,   // PIN na ₦200 (Minti 10)
  "7777888899": 500,   // PIN na ₦500 (Minti 25)
  "1010202030": 1000   // PIN na ₦1,000 (Minti 50)
};

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // 1. Rajistar Mai Amfani
      if (data.type === 'register') {
        clients[data.customNumber] = ws;
        ws.customNumber = data.customNumber;
      }

      // 2. Tabbatar da Lambar PIN (Voucher Top-Up)
      if (data.type === 'redeem-pin') {
        const pin = data.pin.trim();
        if (validPins[pin]) {
          const amount = validPins[pin];
          delete validPins[pin]; // Cire PIN ɗin don kada a sake amfani da shi
          ws.send(JSON.stringify({ type: 'pin-success', amount: amount }));
        } else {
          ws.send(JSON.stringify({ type: 'pin-error', message: 'Lambar PIN ba daidai ba ce ko an yi amfani da ita!' }));
        }
      }

      // 3. Tura saƙonnin Kira (WebRTC Signaling)
      if (data.target && clients[data.target]) {
        clients[data.target].send(JSON.stringify(data));
      }
    } catch (e) {
      console.log('Kuskure:', e);
    }
  });

  ws.on('close', () => {
    if (ws.customNumber && clients[ws.customNumber]) {
      delete clients[ws.customNumber];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server yana aiki a tashar ${PORT}`);
});
