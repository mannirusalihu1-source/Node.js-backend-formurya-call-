const WS = require('ws');
const P = process.env.PORT || 10000;
const wss = new WS.Server({ port: P });
const AT = require('africastalking')({ apiKey: 'U5h@eyD3naHgkWR', username: 'sandbox' });
const sms = AT.SMS;

let u = {}, w = {}, ac = {};
let pins = { "1111222233": 100, "4444555566": 200, "7777888899": 500, "1234567890": 1000 };

wss.on('connection', (ws) => {
    ws.on('message', (msg) => {
        try {
            const d = JSON.parse(msg);
            
            if (d.action === 'register') {
                let ph = d.phone ? d.phone.trim() : '07060838340';
                if (ph.length === 10) ph = '0' + ph;
                if (ph.length === 9) ph = '070' + ph;
                if (ph.length < 11) ph = ph.padEnd(11, '0');
                ws.phone = ph;
                w[ph] = w[ph] || 100;
                ws.send(JSON.stringify({ action: 'registered', phone: ph, balance: w[ph] }));
            }
            else if (d.action === 'opay-recharge') {
                let ph = d.phone, amt = Number(d.amount);
                if (ph && amt > 0) {
                    w[ph] = (w[ph] || 0) + amt;
                    ws.send(JSON.stringify({ action: 'recharge-success', message: `An saka N${amt}!`, newBalance: w[ph] }));
                }
            }
            else if (d.action === 'recharge') {
                let pin = d.pin, ph = d.phone;
                if (pins[pin]) {
                    let amt = pins[pin];
                    w[ph] = (w[ph] || 0) + amt;
                    delete pins[pin];
                    ws.send(JSON.stringify({ action: 'recharge-success', message: `An saka N${amt}!`, newBalance: w[ph] }));
                }
            }
            else if (d.action === 'call-request') {
                let caller = d.callerNumber, recv = d.receiverNumber;
                if ((w[caller] || 0) < 20) {
                    ws.send(JSON.stringify({ action: 'error', message: 'Kudin wallet bai kai N20 ba!' }));
                    return;
                }
                if (u[recv]) {
                    w[caller] -= 20;
                    ws.send(JSON.stringify({ action: 'balance-update', newBalance: w[caller] }));
                    u[recv].send(JSON.stringify({ action: 'incoming-call', callerNumber: caller, signalData: d.signalData }));
                    
                    ac[caller] = setInterval(() => {
                        if (w[caller] >= 20) {
                            w[caller] -= 20;
                            if (u[caller]) u[caller].send(JSON.stringify({ action: 'balance-update', newBalance: w[caller] }));
                        } else {
                            clearInterval(ac[caller]);
                            delete ac[caller];
                            if (u[caller]) u[caller].send(JSON.stringify({ action: 'force-hangup', message: 'Kudin wallet ya kare!' }));
                        }
                    }, 60000);
                }
            }
            else if (d.action === 'end-call') {
                let cNum = d.callerNumber;
                if (cNum && ac[cNum]) {
                    clearInterval(ac[cNum]);
                    delete ac[cNum];
                }
            }
            else if (d.action === 'signal') {
                if (u[d.targetId]) {
                    u[d.targetId].send(JSON.stringify({ action: 'signal', signalData: d.signalData, senderId: d.senderId }));
                }
            }
        } catch (e) {
            console.log('Err:', e);
        }
    });

    ws.on('close', () => {
        if (ws.phone) {
            delete u[ws.phone];
            if (ac[ws.phone]) {
                clearInterval(ac[ws.phone]);
                delete ac[ws.phone];
            }
        }
    });
});

console.log('Server running on port ' + P);

