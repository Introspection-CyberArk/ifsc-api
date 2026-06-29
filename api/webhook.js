// api/webhook.js
const https = require('https');

module.exports = async (req, res) => {
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
                        resolve(null);
                    }
                });
            }).on('error', () => resolve(null));
        });
    };

    // Escape HTML helper utility to prevent parsing crashes
    const escapeHtml = (text) => {
        if (!text) return 'N/A';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

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

    const data = await fetchBankData(incomingText);

    if (!data) {
        const missingMessage = `IFSC Code ${incomingText.toUpperCase()} not found in database.\n\nPowered By\n@Introspection007`;
        await postToTelegram({ chat_id: chatId, text: missingMessage });
        return res.status(200).send('OK');
    }

    // Built using structural safe HTML tags instead of breakable Markdown syntax symbols
    const successMessage = `🏛 <b>BANK DETAILS FOUND</b> 🏛\n\n` +
        `• <b>Bank Name:</b> ${escapeHtml(data.BANK)}\n` +
        `• <b>Branch:</b> ${escapeHtml(data.BRANCH)}\n` +
        `• <b>IFSC Code:</b> ${escapeHtml(data.IFSC)}\n` +
        `• <b>MICR Code:</b> ${escapeHtml(data.MICR || 'Not Available')}\n` +
        `• <b>SWIFT Code:</b> ${escapeHtml(data.SWIFT || 'Not Available (Query Branch)')}\n` +
        `• <b>Address:</b> ${escapeHtml(data.ADDRESS)}\n` +
        `• <b>City:</b> ${escapeHtml(data.CITY)}\n` +
        `• <b>District:</b> ${escapeHtml(data.DISTRICT)}\n` +
        `• <b>State:</b> ${escapeHtml(data.STATE)}\n` +
        `• <b>Contact:</b> ${escapeHtml(data.CONTACT)}\n\n` +
        `⚡ <b>Features Supported:</b>\n` +
        `• UPI: ${data.UPI ? '✅' : '❌'}\n` +
        `• IMPS: ${data.IMPS ? '✅' : '❌'}\n` +
        `• NEFT: ${data.NEFT ? '✅' : '❌'}\n` +
        `• RTGS: ${data.RTGS ? '✅' : '❌'}\n\n` +
        `Powered By\n` +
        `@Introspection007`;

    await postToTelegram({
        chat_id: chatId,
        text: successMessage,
        parse_mode: 'HTML'
    });

    return res.status(200).send('OK');
};
