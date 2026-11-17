const WebSocket = require('ws');
const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });

const AfricasTalking = require('africastalking')({
    apiKey: 'U5h@eyD3naHgkWR',
    username: 'sandbox',
});
const sms = AfricasTalking.SMS;

// Aikin tura SMS ta hanyar Africa's Talking
function sendAlertSMS(phone, messageText) {
    const options = {
        to: [phone],
        message: messageText,
        from: 'sandbox'
    };

    sms.send(options)
        .then(response => {
            console.log('An tura sakon SMS nasara:', response);
        })
        .catch(error => {
            console.log('Matsala wajen tura SMS:', error);
        });
}

let users = {};
let wallets = {};
let activeCalls = {};

let validPins = {
    "1111222233": 100, // Katin 100
    "4444555566": 200, // Katin 200
    "7777888899": 500, // Katin 500
    "1234567890": 1000 // Katin 1,000
};

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // 1. Yi Register ko shiga app tare da lambar lamba 11
            if (data.action === 'register') {
                let phone = data.phone ? data.phone.trim() : '';
                
                if (phone.length === 10) {
                    phone = '0' + phone;
                }
                
                if (!phone || phone.length !== 11) {
                    phone = '091' + Math.floor(10000000 + Math.random() * 90000000);
                }

                ws.phone = phone;
                users[phone] = ws;
                
                if (wallets[phone] === undefined) {
                    wallets[phone] = 100; // 100 na gwaji
                }

                ws.send(JSON.stringify({
                    action: 'registered',
                    phone: phone,
                    balance: wallets[phone]
                }));
            }
            
            // 2. Tsarin Biyan Kuɗi ta Maɓallin OPay
            else if (data.action === 'opay-recharge') {
                const phone = data.phone;
                const amount = data.amount;
                const reference = data.reference;

                if (phone && amount > 0) {
                    wallets[phone] = (wallets[phone] || 0) + Number(amount);

                    ws.send(JSON.stringify({
                        action: 'recharge-success',
                        message: `An tabbatar da biyan N${amount} ta OPay cikin nasara!`,
                        newBalance: wallets[phone]
                    }));
                    
                    sendAlertSMS(phone, `An saka N${amount} a wallet ɗinka na Murya Call ta OPay. Sabon balance ɗinka shine N${wallets[phone]}`);
                } else {
                    ws.send(JSON.stringify({
                        action: 'error',
                        message: 'An samu matsala wajen tabbatar da biyan OPay!'
                    }));
                }
            }
            
            // 3. Tsarin Saka Katin Kira (Recharge Card Top-up)
            else if (data.action === 'recharge') {
                const pin = data.pin;
                const phone = data.phone;

                if (validPins[pin]) {
                    const amount = validPins[pin];
                    wallets[phone] = (wallets[phone] || 0) + amount;
                    
                    delete validPins[pin];

                    ws.send(JSON.stringify({
                        action: 'recharge-success',
                        message: `An saka maka katin N${amount} cikin nasara!`,
                        newBalance: wallets[phone]
                    }));
                } else {
                    ws.send(JSON.stringify({
                        action: 'error',
                        message: 'Wannan lambar katin ba daidai ba ce ko an riga an yi amfani da ita!'
                    }));
                }
            }
            
            // 4. Fara Kira da Cajin N20 duk Minti 1
            else if (data.action === 'call-request') {
                const caller = data.callerNumber;
                const receiver = data.receiverNumber;

                if ((wallets[caller] || 0) < 20) {
                    ws.send(JSON.stringify({
                        action: 'error',
                        message: 'Kudin wallet dinka bai kai N20 ba. Da fatan za a saka kati!'
                    }));
                    return;
                }

                if (users[receiver]) {
                    wallets[caller] -= 20;
                    ws.send(JSON.stringify({
                        action: 'balance-update',
                        newBalance: wallets[caller]
                    }));

                    users[receiver].send(JSON.stringify({
                        action: 'incoming-call',
                        callerNumber: caller,
                        signalData: data.signalData
                    }));

                    activeCalls[caller] = setInterval(() => {
                        if (wallets[caller] >= 20) {
                            wallets[caller] -= 20;
                            if (users[caller]) {
                                users[caller].send(JSON.stringify({
                                    action: 'balance-update',
                                    newBalance: wallets[caller]
                                }));
                            }
                        } else {
                            clearInterval(activeCalls[caller]);
                            delete activeCalls[caller];
                            if (users[caller]) {
                                users[caller].send(JSON.stringify({
                                    action: 'force-hangup',
                                    message: 'Kudin wallet dinka ya kare!'
                                }));
                            }
                        }
                    }, 60000);

                } else {
                    ws.send(JSON.stringify({
                        action: 'error',
                        message: 'Lambar da kake kira bata kan layin a halin yanzu.'
                    }));
                }
            }
            
            // 5. Katse kira
            else if (data.action === 'end-call') {
                if (activeCalls[data.callerNumber]) {
                    clearInterval(activeCalls[data.callerNumber]);
                    delete activeCalls[data.callerNumber];
                }
            }
            
            // 6. Signal tsakanin WebRTC
            else if (data.action === 'signal') {
                if (users[data.targetId]) {
                    users[data.targetId].send(JSON.stringify({
                        action: 'signal',
                        signalData: data.signalData,
                        senderId: data.senderId
                    }));
                }
            }
        } catch (err) {
            console.log('Kuskure wajen karanta sakon JSON:', err);
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

console.log(`Server is running on port ${PORT}`);
