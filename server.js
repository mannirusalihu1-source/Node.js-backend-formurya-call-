const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');

const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Server is running!\n');
});

const wss = new WebSocket.Server({ server });
global.otpStorage = {};

wss.on('connection', (ws) => {
    console.log('Connected.');
    
    ws.on('message', async (msg) => {
        try {
            const data = JSON.parse(msg);

            // 1. Send OTP
            if (data.action === 'send-otp') {
                let p = data.phone;
                if (p && p.startsWith('0')) {
                    p = '+234' + p.slice(1);
                }

                const code = Math.floor(1000 + Math.random() * 9000);
                global.otpStorage[p] = code;

                await axios.post('https://api.termii.com/api/sms/send', {
                    api_key: "tlv_xH5ZHRtqn8v7zbQraVadowtjoyaa-utgwdWPZNuHFy4",
                    to: p,
                    from: "N-Alert",
                    sms: `OTP: ${code}`,
                    type: "plain",
                    channel: "generic"
                });

                ws.send(JSON.stringify({
                    status: 'otp-sent',
                    message: 'An tura OTP!'
                }));
            }

            // 2. Verify OTP
            else if (data.action === 'verify-otp') {
                let p = data.phone;
                if (p && p.startsWith('0')) {
                    p = '+234' + p.slice(1);
                }
                const otp = data.otp;

                if (global.otpStorage[p] && global.otpStorage[p].toString() === otp.toString()) {
                    ws.send(JSON.stringify({
                        status: 'otp-verified',
                        message: 'Nasara!'
                    }));
                } else {
                    ws.send(JSON.stringify({
                        status: 'error',
                        message: 'Kuskure!'
                    }));
                }
            }

            // 3. Make Call
            else if (data.action === 'make-call') {
                const sid = process.env.TWILIO_ACCOUNT_SID;
                const token = process.env.TWILIO_AUTH_TOKEN;
                let p = data.phone;
                
                if (p) {
                    if (p.startsWith('0')) {
                        p = '+234' + p.slice(1);
                    } else if (!p.startsWith('+')) {
                        p = '+' + p;
                    }
                }

                const fromNum = '+18777804236';

                await axios.post(
                    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
                    new URLSearchParams({
                        To: p,
                        From: fromNum,
                        Url: 'http://demo.twilio.com/docs/voice.xml'
                    }),
                    {
                        auth: { username: sid, password: token },
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                    }
                );

                ws.send(JSON.stringify({
                    status: 'call-started',
                    message: 'Ana kira...'
                }));
            }

        } catch (err) {
            console.error("Error:", err.message);
            ws.send(JSON.stringify({
                status: 'error',
                message: 'An samu matsala.'
            }));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('Server port:', PORT);
});
