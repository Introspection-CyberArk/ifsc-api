// api/webhook.js
const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { message } = req.body;
    if (!message || !message.text) {
        return res.status(200).send('OK');
    }

    const chatId = message.chat.id;
    const incomingText = message.text.trim();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    // Handle Start Command
    if (incomingText === '/start') {
        const welcomeMessage = `Welcome to the Bank Details Lookup Bot!\n\nSend me any 11-digit bank IFSC code (e.g., SBIN0001234) to get complete branch information, MICR, and SWIFT codes.\n\nPowered By\n@Introspection007`;
        await axios.post(telegramUrl, { chat_id: chatId, text: welcomeMessage });
        return res.status(200).send('OK');
    }

    // RegEx match for typical Indian IFSC formatting (4 alpha, 0, 6 alpha-numeric)
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/i;

    if (!ifscRegex.test(incomingText)) {
        const invalidMessage = `Invalid IFSC format. Please check the 11-character code and try again.\n\nPowered By\n@Introspection007`;
        await axios.post(telegramUrl, { chat_id: chatId, text: invalidMessage });
        return res.status(200).send('OK');
    }

    try {
        // Querying the automated GitHub dataset endpoint powered by Razorpay API
        const response = await axios.get(`https://ifsc.razorpay.com/${incomingText.toUpperCase()}`);
        const data = response.data;

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

        await axios.post(telegramUrl, {
            chat_id: chatId,
            text: successMessage,
            parse_mode: 'Markdown'
        });

    } catch (error) {
        let errorMessage = `Could not find details for IFSC: ${incomingText.toUpperCase()}. Please double check the code.\n\nPowered By\n@Introspection007`;
        if (error.response && error.response.status === 404) {
            errorMessage = `IFSC Code ${incomingText.toUpperCase()} not found in database.\n\nPowered By\n@Introspection007`;
        }
        await axios.post(telegramUrl, { chat_id: chatId, text: errorMessage });
    }

    return res.status(200).send('OK');
};
