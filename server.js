const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios'); // Mun shigar da axios domin tura sakon Termii

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
    "1111222333": 100, // PIN na ₦100 (Minti 5)
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
                const otpCode = Math.floor(100000 + Math.random() * 900000); // Kirirar lamba 6

                // Ajiye OTP din domin tabbatarwa nan gaba
                global.otpStorage[phoneNumber] = otpCode;

                // Tura sakon OTP ta sabon Termii v4 API
                const termiiResponse = await axios.post('https://v4.api.termcii.com/api/sms/send', {
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
            
            // Idan an buƙaci a tabbatar da OTP
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
            }

        } catch (error) {
            console.error('Kuskure:', error.response?.data || error.message);
            ws.send(JSON.stringify({
                status: 'error',
                message: 'An samu matsala wajen aiwatar da bukatan.'
            }));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
