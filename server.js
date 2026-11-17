const WebSocket = require('ws');
const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });
const AfricasTalking = require('africastalking')({
    apiKey: 'U5h@eyD3naHgkWR',
    username: 'sandbox',
});
const sms = AfricasTalking.SMS;


let users = {};       // Masu amfani da suke kan layi (Online)
let wallets = {};     // Ma'ajiyar kuɗin kowane mutum (Balance)
let activeCalls = {}; // Masu magana a halin yanzu

// JERIN KATUNAN CAJI (RECHARGE CARDS) DOMIN SAMUN RIBARKA
// Zaka iya canza waɗannan lambobin ko ƙara wasu duk lokacin da kake so
let validPins = {
    "1111222233": 100,  // Katin ₦100
    "4444555566": 200,  // Katin ₦200
    "7777888899": 500,  // Katin ₦500
    "1234567890": 1000  // Katin ₦1,000
};

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        // 1. Yi Register ko shiga app
        if (data.action === 'register') {
            ws.phone = data.phone;
            users[data.phone] = ws;
            
            // Idan sabon mutum ne, a ba shi ₦100 na gwaji (ko ka mayar da shi 0 idan ka fara kasuwanci)
            if (wallets[data.phone] === undefined) {
                wallets[data.phone] = 100; 
            }

            ws.send(JSON.stringify({
                action: 'registered',
                phone: data.phone,
                balance: wallets[data.phone]
            }));
        }

        // 2. Tsarin Saka Katin Kira (Recharge Card Top-up)
        else if (data.action === 'recharge') {
            const pin = data.pin;
            const phone = data.phone;

            if (validPins[pin]) {
                const amount = validPins[pin];
                wallets[phone] = (wallets[phone] || 0) + amount;
                
                // Goge katin don kada wani ya sake amfani da shi
                delete validPins[pin];

                ws.send(JSON.stringify({
                    action: 'recharge-success',
                    message: `An saka maka katin ₦${amount} cikin nasara!`,
                    newBalance: wallets[phone]
                }));
            } else {
                ws.send(JSON.stringify({
                    action: 'error',
                    message: 'Wannan lambar katin ba daidai ba ce ko an riga an yi amfani da ita!'
                }));
            }
        }

        // 3. Fara Kira da Cajin ₦20 duk Minti 1
        else if (data.action === 'call-request') {
            const caller = data.callerNumber;
            const receiver = data.receiverNumber;

            // Bincika ko mai kiran yana da akalla ₦20
            if ((wallets[caller] || 0) < 20) {
                ws.send(JSON.stringify({
                    action: 'error',
                    message: 'Kuɗin wallet ɗinka bai kai ₦20 ba. Da fatan za a saka kati!'
                }));
                return;
            }

            if (users[receiver]) {
                // Cire ₦20 na mintin farko da zarar an fara kiran
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

                // Cire ₦20 duk bayan daƙiƙa 60 (minti 1)
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
                        // Katse kiran idan kuɗin ya ƙare
                        clearInterval(activeCalls[caller]);
                        delete activeCalls[caller];
                        if (users[caller]) {
                            users[caller].send(JSON.stringify({
                                action: 'force-hangup',
                                message: 'Kuɗin wallet ɗinka ya ƙare!'
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

        // 4. Katse kira da tsaida cajin kuɗi
        else if (data.action === 'end-call') {
            if (activeCalls[data.callerNumber]) {
                clearInterval(activeCalls[data.callerNumber]);
                delete activeCalls[data.callerNumber];
            }
        }

        // 5. Signal tsakanin WebRTC
        else if (data.action === 'signal') {
            if (users[data.targetId]) {
                users[data.targetId].send(JSON.stringify({
                    action: 'signal',
                    signalData: data.signalData,
                    senderId: data.senderId
                }));
            }
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

// Aikin tura sakon SMS ta hanyar Africa's Talking
function sendAlertSMS(phone, messageText) {
    const options = {
        to: [phone],
        message: messageText
    };

    sms.send(options)
        .then(response => {
            console.log('An tura sakon SMS nasara:', response);
        })
        .catch(error => {
            console.log('Matsala wajen tura SMS:', error);
        });
}

