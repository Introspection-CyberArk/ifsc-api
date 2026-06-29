// api/webhook.js
const https = require('https');

module.exports = async (req, res) => {
    // Intercept invalid routing methods
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end('Method Not Allowed');
    }

    const { message } = req.body || {};
    if (!message || !message.text) {
        return res.status(200).send('OK');
    }

    const chatId = message.chat.id;
    const incomingText = message.text.trim();
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '8749202267:AAG9KNIY4duOid7z6l_nuzV9_jVLOBAZztE';

    // Inline native HTTPS request module helper to avoid Axios deployment crashes
    const postToTelegram = (payload) => {
        return new Promise((resolve, reject) => {
            const dataStr = JSON.stringify(payload);
            const options = {
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${botToken}/sendMessage`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': dataStr.length,
                },
            };
            const request = https.request(options, (response) => {
                let body = '';
                response.on('data', (chunk) => (body += chunk));
                response.on('end', () => resolve(body));
            });
            request.on('error', (err) => reject(err));
            request.write(dataStr);
            request.end();
        });
    };

    const fetchBankData = (ifsc) => {
        return new Promise((resolve, reject) => {
            https.get(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`, (response) => {
                let body = '';
                response.on('data', (chunk) => (body += chunk));
                response.on('end', () => {
                    try {
                        if (response.statusCode === 404) resolve(null);
                        else resolve(JSON.parse(body));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', (err) => reject(err));
        });
    };

    // System Commands Execution Paths
    if (incomingText === '/start') {
        const welcomeMessage = `Welcome to the Bank Details Lookup Bot!\n\nSend me any 11-digit bank IFSC code (e.g., SBIN0001234) to get complete branch information, MICR, and SWIFT codes.\n\nPowered By\n@Introspection007`;
        await postToTelegram({ chat_id: chatId, text: welcomeMessage });
        return res.status(200).send('OK');
    }

    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
    if (!ifscRegex.test(incomingText)) {
        const invalidMessage = `Invalid IFSC format. Please check the 11-character code and try again.\n\nPowered By\n@Introspection007`;
        await postToTelegram({ chat_id: chatId, text: invalidMessage });
        return res.status(200).send('OK');
    }

    try {
        const data = await fetchBankData(incomingText);

        if (!data) {
            const missingMessage = `IFSC Code ${incomingText.toUpperCase()} not found in database.\n\nPowered By\n@Introspection007`;
            await postToTelegram({ chat_id: chatId, text: missingMessage });
            return res.status(200).send('OK');
        }

        const successMessage = `🏛 *BANK DETAILS FOUND* 🏛\n\n` +
            `• *Bank Name:* ${data.BANK || 'N/A'}\n` +
            `• *Branch:* ${data.BRANCH || 'N/A'}\n` +
            `• *IFSC Code:* ${data.IFSC || 'N/A'}\n` +
            `• *MICR Code:* ${data.MICR || 'Not Available'}\n` +
            `• *SWIFT Code:* ${data.SWIFT || 'Not Available (Query Branch)'}\n` +
            `• *Address:* ${data.ADDRESS || 'N/A'}\n` +
            `• *City:* ${data.CITY || 'N/A'}\n` +
            `• *District:* ${data.DISTRICT || 'N/A'}\n` +
            `• *State:* ${data.STATE || 'N/A'}\n` +
            `• *Contact:* ${data.CONTACT || 'N/A'}\n\n` +
            `⚡ *Features Supported:*\n` +
            `• UPI: ${data.UPI ? '✅' : '❌'}\n` +
            `• IMPS: ${data.IMPS ? '✅' : '❌'}\n` +
            `• NEFT: ${data.NEFT ? '✅' : '❌'}\n` +
            `• RTGS: ${data.RTGS ? '✅' : '❌'}\n\n` +
            `Powered By\n` +
            `@Introspection007`;

        await postToTelegram({
            chat_id: chatId,
            text: successMessage,
            parse_mode: 'Markdown'
        });

    } catch (error) {
        const errorMessage = `Could not find details for IFSC: ${incomingText.toUpperCase()}.\n\nPowered By\n@Introspection007`;
        await postToTelegram({ chat_id: chatId, text: errorMessage });
    }

    return res.status(200).send('OK');
};
