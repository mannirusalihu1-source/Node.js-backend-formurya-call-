
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

let users = {}; // Ajiye mai amfani da WebSocket ɗinsa
let wallets = { "07060838340": 100 }; // Ajiyar kuɗin wallet

wss.on('connection', (ws) => {
    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);

            // Lokacin da mai amfani ya shiga app
            if (data.action === 'register') {
                let ph = data.phone ? data.phone.trim() : '07060838340';
                ws.phone = ph;
                users[ph] = ws; // Anan muka adana lambar mai amfani daidai!
                wallets[ph] = wallets[ph] || 100;

                ws.send(JSON.stringify({
                    action: 'registered',
                    phone: ph,
                    balance: wallets[ph]
                }));
            }

            // Lokacin da aka tura buƙatar kira
            else if (data.action === 'call-request') {
                let caller = data.callerNumber;
                let recv = data.receiverNumber;

                if ((wallets[caller] || 0) < 20) {
                    ws.send(JSON.stringify({ action: 'error', message: 'Kuɗi sun kare a wallet dinka.' }));
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

                } else {
        ws.send(JSON.stringify({ action: 'error', message: 'Wannan lamba bata kan layin yanar gizo a yanzu.' }));
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
        }
    });

    ws.on('close', () => {
        if (ws.phone) {
            delete users[ws.phone];
        }
    });
});

// Express POST API don ainihin kiran waje (Idan kana son haɗawa da AfricasTalking nan gaba)
app.post('/make-call', async (req, res) => {
    const { caller, recipient } = req.body;
    console.log(`An karbi buƙatar kira daga ${caller} zuwa ga ${recipient}`);
    res.json({ success: true, message: 'An fara kiran layin a waje.' });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server tana aiki a kan port ${PORT}`);
});