const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Murya Call Backend is running successfully!');
});

// Ajiye masu amfani da suka shiga da lambobin su na musamman
let clients = {};

wss.on('connection', (ws) => {
  console.log('Sabon mai amfani ya haɗu da Murya Call server.');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Idan mai amfani ya yi register da lambarsa ta musamman
      if (data.type === 'register') {
        clients[data.customNumber] = ws;
        ws.customNumber = data.customNumber;
        console.log(`An yi rajistar mai amfani da lamba: ${data.customNumber}`);
      }

      // Idan ana son tura kira, offer, answer, ko ice-candidate zuwa ga wani
      if (data.target && clients[data.target]) {
        clients[data.target].send(JSON.stringify(data));
      }
    } catch (e) {
      console.log('Kuskure wajen karanta sako:', e);
    }
  });

  ws.on('close', () => {
    if (ws.customNumber && clients[ws.customNumber]) {
      delete clients[ws.customNumber];
      console.log(`An cire mai amfani: ${ws.customNumber}`);
    }
    console.log('An katse hadin mai amfani.');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server yana aiki a tashar ${PORT}`);
});
