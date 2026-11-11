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

wss.on('connection', (ws) => {
  console.log('Sabon mai amfani ya haɗu da Murya Call server.');

  ws.on('message', (message) => {
    console.log(`An karɓi saƙo: ${message}`);
    
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    console.log('An katse haɗin mai amfani.');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server yana ta aiki a lambar tashar: ${PORT}`);
});
