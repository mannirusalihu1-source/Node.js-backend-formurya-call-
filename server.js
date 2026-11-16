const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Murya Call Billing & WebRTC Server is running!\n');
});

const wss = new WebSocket.Server({ server });
let clients = {}; // Ajiye lambobin masu amfani da kuma WebSocket ɗinsu
let wallets = {}; // Ajiye kuɗin da ke cikin asusun kowane mai amfani

wss.on('connection', (ws) => {
    console.log('Client connected.');

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);

            // 1. Yin Register da ba wa mutumlamba ko ID
            if (data.action === 'register') {
                const userNumber = data.phone; // Lambar mai amfani
                clients[userNumber] = ws;
                
                // Idan sabon mutum ne, mu buɗe masa wallet da ko da 0 ne ko kyautar farawa
                if (!wallets[userNumber]) {
                    wallets[userNumber] = 100; // Misali mun ba shi 100 Naira kyautar gwaji
                }

                ws.send(JSON.stringify({
                    action: 'registered',
                    phone: userNumber,
                    balance: wallets[userNumber]
                }));
                console.log('User registered with number:', userNumber);
            }

            // 2. Duba ko yana da kuɗi sannan a tura kiran (Signaling)
            else if (data.action === 'call-request') {
                const caller = data.callerNumber;
                const receiver = data.receiverNumber;

                // Duba ko mai kiran yana da kuɗi a Wallet (misali aƙalla Naira 10)
                if (wallets[caller] && wallets[caller] >= 10) {
                    const targetWs = clients[receiver];
                    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                        // Sanar da wanda ake kira cewa ana kiransa
                        targetWs.send(JSON.stringify({
                            action: 'incoming-call',
                            callerNumber: caller,
                            signalData: data.signalData
                        }));
                    } else {
                        ws.send(JSON.stringify({ action: 'error', message: 'Lambar bata online ba ko bata wanzu.' }));
                    }
                } else {
                    ws.send(JSON.stringify({ action: 'error', message: 'Kudin asusunka sun ƙare! Ka cika kuɗi (Top up).' }));
                }
            }

            // 3. Tura WebRTC Signaling tsakaninsu
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
    console.log('Server port:', PORT);
});
