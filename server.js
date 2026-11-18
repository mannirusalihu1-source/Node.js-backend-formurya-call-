const WebSocket = require('ws');
const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });
const AT = require('africastalking')({ apiKey: 'U5h@eyD3naHgkWR', username: 'sandbox' });
const sms = AT.SMS;

let users = {};
let wallets = {};
let activeCalls = {};
let validPins = { "1111222233": 100, "4444555566": 200, "7777888899": 500, "1234567890": 1000 };

wss.on('connection', (ws) => {
    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);
            
            if (data.action === 'register') {
                let p = data.phone ? data.phone.trim() : '09100000000';
                if (p.length === 10) p = '0' + p;
                ws.phone = p;
                users[p] = ws;
                if (!wallets[p]) wallets[p] = 100;
                ws.send(JSON.stringify({ action: 'registered', phone: p, balance: wallets[p] }));
            }
            else if (data.action === 'opay-recharge') {
                let p = data.phone, amt = Number(data.amount);
                if (p && amt > 0) {
                    wallets[p] = (wallets[p] || 0) + amt;
                    ws.send(JSON.stringify({ action: 'recharge-success', message: `An saka N${amt}!`, newBalance: wallets[p] }));
                }
            }
            else if (data.action === 'recharge') {
                let pin = data.pin, p = data.phone;
                if (validPins[pin]) {
                    let amt = validPins[pin];
                    wallets[p] = (wallets[p] || 0) + amt;
                    delete validPins[pin];
                    ws.send(JSON.stringify({ action: 'recharge-success', message: `An saka N${amt}!`, newBalance: wallets[p] }));
                }
            }
            else if (data.action === 'call-request') {
                let c = data.callerNumber, r = data.receiverNumber;
                if ((wallets[c] || 0) < 20) {
                    ws.send(JSON.stringify({ action: 'error', message: 'Kudin wallet dinka bai kai N20 ba!' }));
                    return;
                }
                if (users[r]) {
                    wallets[c] -= 20;
                    ws.send(JSON.stringify({ action: 'balance-update', newBalance: wallets[c] }));
                    
                    let callMsg = JSON.stringify({ action: 'incoming-call', callerNumber: c, signalData: data.signalData });
                    users[r].send(callMsg);
                    
                    activeCalls[c] = setInterval(() => {
                        if (wallets[c] >= 20) {
                            wallets[c] -= 20;
                            if (users[c]) {
                                let balMsg = JSON.stringify({ action: 'balance-update', newBalance: wallets[c] });
                                users[c].send(balMsg);
                            }
                        } else {
                            clearInterval(activeCalls[c]);
                            delete activeCalls[c];
                            if (users[c]) {
                                let stopMsg = JSON.stringify({ action: 'force-hangup', message: 'Kudin wallet dinka ya kare!' });
                                users[c].send(stopMsg);
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
                    let sigMsg = JSON.stringify({ action: 'signal', signalData: data.signalData, senderId: data.senderId });
                    users[data.targetId].send(sigMsg);
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
