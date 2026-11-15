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
