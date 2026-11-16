const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Murya Call WebRTC Server is running!\n');
});

const wss = new WebSocket.Server({ server });

// Ajiye masu amfani da suka shiga (Clients)
let clients = {};

wss.on('connection', (ws) => {
    console.log('Client connected.');

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);

            // Idan mai amfani ya yi Register da suna ko ID nasa
            if (data.action === 'register') {
                clients[data.userId] = ws;
                console.log(`User registered: ${data.userId}`);
            }

            // Tura WebRTC Signaling data (Offer, Answer, ICE) zuwa ga wanda ake kira
            else if (data.action === 'signal') {
                const targetClient = clients[data.targetId];
                if (targetClient && targetClient.readyState === WebSocket.OPEN) {
                    targetClient.send(JSON.stringify({
                        action: 'signal',
                        senderId: data.senderId,
                        signalData: data.signalData
                    }));
                }
            }

        } catch (err) {
            console.error("Error:", err.message);
        }
    });

    ws.on('close', () => {
        // Cire mutumin da ya fita daga jerin clients
        for (let id in clients) {
            if (clients[id] === ws) {
                delete clients[id];
                console.log(`User disconnected: ${id}`);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('Server port:', PORT);
});
