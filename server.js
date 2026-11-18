const WebSocket = require('ws');
const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });
const AfricasTalking = require('africastalking')({ apiKey: 'U5h@eyD3naHgkWR', username: 'sandbox' });
const sms = AfricasTalking.SMS;

let users = {};
let wallets = {};
let activeCalls = {};
let validPins = { "1111222233": 100, "4444555566": 200, "7777888899": 500, "1234567890": 1000 };

wss.on('connection', (ws) => {
    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);
            
            if (data.action === 'register') {
                let phone = data.phone ? data.phone.trim() : '09100000000';
                if (phone.length === 10) phone = '0' + phone;
                ws.phone = phone;
                users[phone] = ws;
                if (!wallets[phone]) wallets[phone] = 100;
                ws.send(JSON.stringify({ action: 'registered', phone: phone, balance: wallets[phone] }));
            }
            else if (data.action === 'opay-recharge') {
                let phone = data.phone;
                let amount = Number(data.amount);
                if (phone && amount > 0) {
                    wallets[phone] = (wallets[phone] || 0) + amount;
                    ws.send(JSON.stringify({ action: 'recharge-success', message: `An saka N${amount}!`, newBalance: wallets[phone] }));
                }
            }
            else if (data.action === 'recharge') {
                let pin = data.pin;
                let phone = data.phone;
                if (validPins[pin]) {
                    let amount = validPins[pin];
                    wallets[phone] = (wallets[phone] || 0) + amount;
                    delete validPins[pin];
                    ws.send(JSON.stringify({ action: 'recharge-success', message: `An saka N${amount}!`, newBalance: wallets[phone] }));
                }
            }
            else if (data.action === 'call-request') {
                let caller = data.callerNumber;
                let receiver = data.receiverNumber;
                if ((wallets[caller] || 0) < 20) {
                    ws.send(JSON.stringify({ action: 'error', message: 'Kudin wallet dinka bai kai N20 ba!' }));
                    return;
                }
                if (users[receiver]) {
                    wallets[caller] -= 20;
                    ws.send(JSON.stringify({ action: 'balance-update', newBalance: wallets[caller] }));
                    users[receiver].send(JSON.stringify({ action: 'incoming-call', callerNumber: caller, signalData: data.signalData }));
                    
                    activeCalls[caller] = setInterval(() => {
                        if (wallets[caller] >= 20) {
                            wallets[caller] -= 20;
                            if (users[caller]) {
                                users[caller].send(JSON.stringify({ action: 'balance-update', newBalance: wallets[caller] }));
                            }
                        } else {
                            clearInterval(activeCalls[caller]);
                            delete activeCalls[caller];
                            if (users[caller]) {
                                users[caller].send(JSON.stringify({ action: 'force-hangup', message: 'Kudin wallet dinka ya kare!' }));
                            }
                        }
                    }, 60000);
                }
            }
            else if (data.action === 'end-call') {
                let cNum = data.callerNumber;
                if (cNum && activeCalls[cNum]) {
                    clearInterval(activeCalls[cNum]);
                    delete activeCalls[cNum];
                }
            }
            else if (data.action === 'signal') {
                if (users[data.targetId]) {
                    users[data.targetId].send(JSON.stringify({ action: 'signal', signalData: data.signalData, senderId: data.senderId }));
                }
            }
        } catch (e) {
            console.log('Error:', e);
        }
    });

    ws.on('close', () => {
        if (ws.phone) {
            delete users[ws.phone];
            if (activeCalls[ws.phone]) {
                clearInterval(activeCalls[ws.phone]);
                delete activeCalls[ws.phone];
            }
        }
    });
});

console.log(`Server running on port ${PORT}`);
