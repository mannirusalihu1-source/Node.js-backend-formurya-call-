const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Murya Call Server is running!\n');
});

const wss = new WebSocket.Server({ server });
let clients = {};
let wallets = {};

wss.on('connection', (ws) => {
    console.log('Client connected.');

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);

            if (data.action === 'register') {
                const userNum = data.phone;
                clients[userNum] = ws;
                
                if (!wallets[userNum]) {
                    wallets[userNum] = 100;
                }

                ws.send(JSON.stringify({
                    action: 'registered',
                    phone: userNum,
                    balance: wallets[userNum]
                }));
            }

            else if (data.action === 'call-request') {
                const caller = data.callerNumber;
                const receiver = data.receiverNumber;

                if (wallets[caller] && wallets[caller] >= 10) {
                    const targetWs = clients[receiver];
                    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                        targetWs.send(JSON.stringify({
                            action: 'incoming-call',
                            callerNumber: caller,
                            signalData: data.signalData
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            action: 'error',
                            message: 'Lambar bata online ba.'
                        }));
                    }
                } else {
                    ws.send(JSON.stringify({
                        action: 'error',
                        message: 'Kudin asusunka sun kare!'
                    }));
                }
            }

            else if (data.action === 'signal') {
                const target = clients[data.targetId];
                if (target && target.readyState === WebSocket.OPEN) {
                    target.send(JSON.stringify({
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
        for (let id in clients) {
            if (clients[id] === ws) {
                delete clients[id];
                console.log('Disconnected:', id);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('Port:', PORT);
});
