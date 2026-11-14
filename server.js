const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios'); // Mun shigar da axios domin tura saƙon Termii

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Murya Call Backend & Billing System is running!');
});

let clients = {};
global.otpStorage = {};

// Lambobin PIN na Gwaji da adadin kudinsu
let validPins = {
    "1111222233": 100, // PIN na ₦100 (Minti 5)
    "444455566": 200,  // PIN na ₦200 (Minti 10)
};

wss.on('connection', (ws) => {
    console.log('Sabon mai amfani ya haɗu ta WebSocket.');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            // Idan an buƙaci a tura OTP
            if (data.action === 'send-otp') {
                const phoneNumber = data.phone;
                const otpCode = Math.floor(100000 + Math.random() * 900000); // Ƙirƙirar lamba 6

                // Ajiye OTP ɗin domin tabbatarwa nan gaba
                global.otpStorage[phoneNumber] = otpCode;

                // Tura saƙon OTP ta Termii API
                const termiiResponse = await axios.post('https://api.ng.termii.com/api/sms/send', {
                    api_key: "tlv_xH5ZHRTqn8v7zbQraVadowtjoyaa-utgwdWPZNuHFy4",
                    to: phoneNumber,
                    from: "N-Alert",
                    sms: `Lambar tabbatarwa ta Murya Call ita ce: ${otpCode}`,
                    type: "plain",
                    channel: "generic"
                });

                console.log('Termii Response:', termiiResponse.data);

                ws.send(JSON.stringify({
                    status: 'otp-sent',
                    message: 'An tura OTP zuwa lambar wayarka nasara!'
                }));
            }

            // Idan an buƙaci a tabbatgar da OTP
            else if (data.action === 'verify-otp') {
                const phoneNumber = data.phone;
                const userOtp = data.otp;

                if (global.otpStorage[phoneNumber] && global.otpStorage[phoneNumber] == userOtp) {
                    ws.send(JSON.stringify({
                        status: 'otp-verified',
                        message: 'An tabbatar da lambar OTP nasara!'
                    }));
                } else {
                    ws.send(JSON.stringify({
                        status: 'error',
                        message: 'Lambar OTP ba daidai ba ce ko kuma ta wuce lokaci.'
                    }));
                }
            }// Idan an buƙaci a tura O
          
if (data.action === 'send-otp') {
    const phoneNumber = data.phone;
    const otpCode = Math.floor(100000 + Math.random() * 900000); // Kirkirar lamba 6

    // Ajiye OTP din domin tabbatarwa nan gaba
    global.otpStorage[phoneNumber] = otpCode;

    // Tura sakon OTP ta sabon Termii v4 API
    const termiiResponse = await axios.post('https://v4.api.termii.com/api/sms/send', {
        api_key: "tlv_xH5ZHRTqn8v7zbQraVadowtjoyaa-utgwdWPZNuHFy4",
        to: phoneNumber,
        from: "2347013833786",
        sms: `Lambar tabbatarwa ta Murya Call ita ce: ${otpCode}`,
        type: "plain",
        channel: "generic"
    });

    console.log('Termii Response:', termiiResponse.data);

    ws.send(JSON.stringify({
        status: 'otp-sent',
        message: 'An tura OTP zuwa lambar wayarka nasara!'
    }));
}
  