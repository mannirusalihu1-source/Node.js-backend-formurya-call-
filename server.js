const WebSocket = require('ws');
const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });

let users = {}; // Tsarin adana masu amfani da lambobi da balances su
let activeCalls = {}; // Tsarin kula da lokacin kiran mutane

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        // 1. Yi Register ko shiga app
        if (data.action === 'register') {
            ws.phone = data.phone;
            users[data.phone] = ws;
            
            // Idan sabon mutum ne, a bashi ₦100 kyauta ko ₦0 gwargwadon tsari
            let balance = 100; 
            ws.send(JSON.stringify({
                action: 'registered',
                phone: data.phone,
                balance: balance
            }));
        }

        // 2. Tsarin Katin Kira (Recharge Card Top-up)
        else if (data.action === 'recharge') {
            const pin = data.pin;
            // Misali: Katin ₦200 zai ba da daraja ta musamman, kana iya sa dokar katin nan
            if (pin && pin.length === 10) { // Misali idan pin ɗin ya kai lamba 10
                // Ƙara kuɗi a wallet ɗin mai amfani (Misali ka ƙara ₦200)
                // Wannan shine inda zaka sa ainihin lissafin ribarka da siyar da katin
                ws.send(JSON.stringify({
                    action: 'recharge-success',
                    message: 'An karɓi katin kuɗi cikin nasara!',
                    newBalance: 250 // Misali sabon balance
                }));
            } else {
                ws.send(JSON.stringify({
                    action: 'error',
                    message: 'Lambar katin da ka saka ba daidai ba ce!'
                }));
            }
        }

        // 3. Omban Fara Kira (Call Request da Cajin ₦20/minti)
        else if (data.action === 'call-request') {
            const caller = data.callerNumber;
            const receiver = data.receiverNumber;

            // Bincika ko mai kiran yana da akalla ₦20
            // (A nan za mu iya ƙara binciken wallet balance ɗin mai kira)

            if (users[receiver]) {
                users[receiver].send(JSON.stringify({
                    action: 'incoming-call',
                    callerNumber: caller,
                    signalData: data.signalData
                }));

                // Fara kirgawa don cire ₦20 duk bayan minti 1 (dakika 60)
                activeCalls[caller] = setInterval(() => {
                    // Cire ₦20 duk minti ɗaya daga baya idan ana magana
                    console.log(`Ana cire ₦20 daga ${caller}`);
                }, 60000);
            } else {
                ws.send(JSON.stringify({
                    action: 'error',
                    message: 'Lambar da kake kira bata kan layin a halin yanzu.'
                }));
            }
        }

        // 4. Signal tsakanin WebRTC
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
