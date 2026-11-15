const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Murya Call Server is running successfully!\n');
});

const wss = new WebSocket.Server({ server });

global.otpStorage = {};

wss.on('connection', (ws) => {
    console.log('Sabon mai amfani ya haɗu da Server (Connected).');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            // 1. Tura Saƙon OTP ta Termii API
            if (data.action === 'send-otp') {
                const phoneNumber = data.phone;
                const otpCode = Math.floor(1000 + Math.random() * 9000);
                global.otpStorage[phoneNumber] = otpCode;

                const termiiResponse = await axios.post('https://api.termii.com/api/sms/send', {
                    api_key: "tlv_xH5ZHRtqn8v7zbQraVadowtjoyaa-utgwdWPZNuHFy4",
                    to: phoneNumber,
                    from: "MuryaCall",
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

            // 2. Tabbatar da OTP da mai amfani ya saka
            else if (data.action === 'verify-otp') {
                const phoneNumber = data.phone;
                const userOtp = data.otp;

                if (global.otpStorage[phoneNumber] && global.otpStorage[phoneNumber].toString() === userOtp.toString()) {
                    ws.send(JSON.stringify({
                        status: 'otp-verified',
                        message: 'An tabbatar da lambar nasara!'
                    }));
                } else {
                    ws.send(JSON.stringify({
                        status: 'error',
                        message: 'Lambar OTP ba daidai ba ce ko kuma ta wuce lokaci.'
                    }));
                }
            }

            // 3. Fara Kira ta Twilio Voice API
            else if (data.action === 'make-call') {
                const accountSid = process.env.TWILIO_ACCOUNT_SID;
                const authToken = process.env.TWILIO_AUTH_TOKEN;
                const targetPhoneNumber = data.phone;
                const twilioNumber = '+18777804236';

                const twilioResponse = await axios.post(
                    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
                    new URLSearchParams({
                        To: targetPhoneNumber,
                        From: twilioNumber,
                        Url: 'http://demo.twilio.com/docs/voice.xml'
                    }),
                    {
                        auth: {
                            username: accountSid,
                            password: authToken
                        },
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );

                console.log('Twilio Response:', twilioResponse.data);
                ws.send(JSON.stringify({
                    status: 'call-started',
                    message: 'Ana neman lambar da aka kira...'
                }));
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
