// webhook.js
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

    const searchBanks = (bankCode) => {
        return new Promise((resolve, reject) => {
            https.get(`https://ifsc.razorpay.com/search?bankcode=${bankCode.toUpperCase()}&limit=10`, (response) => {
                let body = '';
                response.on('data', (chunk) => (body += chunk));
                response.on('end', () => {
                    try {
                        if (response.statusCode === 200) resolve(JSON.parse(body));
                        else resolve(null);
                    } catch (e) {
                        resolve(null);
                    }
                });
            }).on('error', () => resolve(null));
        });
    };

    const escapeHtml = (text) => {
        if (!text) return 'N/A';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    // Bank name to code mapping
    const bankCodes = {
        'sbi': 'SBIN',
        'state bank': 'SBIN',
        'hdfc': 'HDFC',
        'icici': 'ICICI',
        'axis': 'UTIB',
        'axis bank': 'UTIB',
        'kotak': 'KKBK',
        'kotak mahindra': 'KKBK',
        'yes bank': 'YESB',
        'yes': 'YESB',
        'pnb': 'PUNB',
        'punjab national bank': 'PUNB',
        'canara bank': 'CNRB',
        'canara': 'CNRB',
        'bank of baroda': 'BARB',
        'baroda': 'BARB',
        'idbi': 'IDBI',
        'idbi bank': 'IDBI',
        'indian bank': 'IDIB',
        'indian': 'IDIB',
        'indian overseas': 'IOBA',
        'indian overseas bank': 'IOBA',
        'union bank': 'UBIN',
        'union': 'UBIN',
        'uco bank': 'UCBA',
        'uco': 'UCBA',
        'central bank': 'CBIN',
        'central': 'CBIN'
    };

    // Handle /start command
    if (incomingText === '/start') {
        const welcomeMessage = `🏦 **Bank Details Lookup Bot**

Just type a **bank name** (e.g., HDFC, SBI, ICICI) to get IFSC codes!

Or send an **IFSC code** for complete details.

**Examples:**
• HDFC
• SBI
• ICICI
• HDFC0000501

━━━━━━━━━━━━━━━━━━━━━
🤖 Powered By @Introspection007`;

        await postToTelegram({ 
            chat_id: chatId, 
            text: welcomeMessage,
            parse_mode: 'Markdown'
        });
        return res.status(200).send('OK');
    }

    // Check if it's an IFSC code (11 chars, first 4 letters)
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
    const isIfsc = ifscRegex.test(incomingText);

    if (isIfsc) {
        // ============ HANDLE IFSC CODE ============
        const data = await fetchBankData(incomingText);

        if (!data) {
            const missingMessage = `❌ IFSC Code ${incomingText.toUpperCase()} not found.\n\n━━━━━━━━━━━━━━━━━━━━━\n🤖 Powered By @Introspection007`;
            await postToTelegram({ chat_id: chatId, text: missingMessage });
            return res.status(200).send('OK');
        }

        const successMessage = `🏛 <b>BANK DETAILS FOUND</b> 🏛\n\n` +
            `• <b>Bank Name:</b> ${escapeHtml(data.BANK)}\n` +
            `• <b>Branch:</b> ${escapeHtml(data.BRANCH)}\n` +
            `• <b>IFSC Code:</b> ${escapeHtml(data.IFSC)}\n` +
            `• <b>MICR Code:</b> ${escapeHtml(data.MICR || 'Not Available')}\n` +
            `• <b>SWIFT Code:</b> ${escapeHtml(data.SWIFT || 'Not Available')}\n` +
            `• <b>Address:</b> ${escapeHtml(data.ADDRESS)}\n` +
            `• <b>City:</b> ${escapeHtml(data.CITY)}\n` +
            `• <b>District:</b> ${escapeHtml(data.DISTRICT)}\n` +
            `• <b>State:</b> ${escapeHtml(data.STATE)}\n` +
            `• <b>Contact:</b> ${escapeHtml(data.CONTACT)}\n\n` +
            `⚡ <b>Services:</b>\n` +
            `• UPI: ${data.UPI ? '✅' : '❌'}\n` +
            `• IMPS: ${data.IMPS ? '✅' : '❌'}\n` +
            `• NEFT: ${data.NEFT ? '✅' : '❌'}\n` +
            `• RTGS: ${data.RTGS ? '✅' : '❌'}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `🤖 Powered By @Introspection007`;

        await postToTelegram({
            chat_id: chatId,
            text: successMessage,
            parse_mode: 'HTML'
        });
        return res.status(200).send('OK');
    }

    // ============ HANDLE BANK NAME SEARCH ============
    const searchTerm = incomingText.toLowerCase().trim();
    let bankCode = null;

    // Find matching bank code
    for (const [key, code] of Object.entries(bankCodes)) {
        if (key.includes(searchTerm) || searchTerm.includes(key)) {
            bankCode = code;
            break;
        }
    }

    if (!bankCode && searchTerm.length >= 4) {
        bankCode = searchTerm.substring(0, 4).toUpperCase();
    }

    if (bankCode) {
        const results = await searchBanks(bankCode);

        if (results && results.length > 0) {
            let reply = `🏦 **Branches for ${incomingText.toUpperCase()}**\n\n`;

            for (let i = 0; i < Math.min(results.length, 10); i++) {
                const branch = results[i];
                reply += `${i+1}. **${escapeHtml(branch.BRANCH)}**\n`;
                reply += `   IFSC: \`${escapeHtml(branch.IFSC)}\`\n`;
                reply += `   City: ${escapeHtml(branch.CITY)}\n`;
                reply += `   Address: ${escapeHtml(branch.ADDRESS).substring(0, 60)}...\n\n`;
            }

            if (results.length > 10) {
                reply += `*Showing 10 of ${results.length} branches*\n\n`;
            }

            reply += `━━━━━━━━━━━━━━━━━━━━━\n`;
            reply += `💡 Send any IFSC code for full details!\n\n`;
            reply += `🤖 Powered By @Introspection007`;

            await postToTelegram({
                chat_id: chatId,
                text: reply,
                parse_mode: 'Markdown'
            });
            return res.status(200).send('OK');
        }
    }

    // No results found
    const notFoundMessage = `🔍 **No branches found for '${incomingText}'**

Try these bank names:
• HDFC
• SBI
• ICICI
• Axis
• Canara Bank
• Kotak
• Yes Bank

Or send an IFSC code directly!

━━━━━━━━━━━━━━━━━━━━━
🤖 Powered By @Introspection007`;

    await postToTelegram({
        chat_id: chatId,
        text: notFoundMessage,
        parse_mode: 'Markdown'
    });

    return res.status(200).send('OK');
};
