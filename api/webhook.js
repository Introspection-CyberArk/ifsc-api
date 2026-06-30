// webhook.js
const https = require('https');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end('Method Not Allowed');
    }

    const { message, callback_query } = req.body || {};
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '8749202267:AAG9KNIY4duOid7z6l_nuzV9_jVLOBAZztE';

    // ============ HELPER FUNCTIONS ============

    const postToTelegram = (payload) => {
        return new Promise((resolve, reject) => {
            const dataStr = JSON.stringify(payload);
            const options = {
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${botToken}/sendMessage`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': dataStr.length },
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

    const editMessage = (payload) => {
        return new Promise((resolve, reject) => {
            const dataStr = JSON.stringify(payload);
            const options = {
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${botToken}/editMessageText`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': dataStr.length },
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

    const answerCallback = (callbackId) => {
        return new Promise((resolve) => {
            const dataStr = JSON.stringify({ callback_query_id: callbackId });
            const options = {
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${botToken}/answerCallbackQuery`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': dataStr.length },
            };
            const request = https.request(options, () => resolve());
            request.write(dataStr);
            request.end();
        });
    };

    // ============ API FUNCTIONS ============

    // 1. Razorpay IFSC API - Core
    const fetchBankData = (ifsc) => {
        return new Promise((resolve) => {
            https.get(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`, (response) => {
                let body = '';
                response.on('data', (chunk) => (body += chunk));
                response.on('end', () => {
                    try {
                        if (response.statusCode === 404) resolve(null);
                        else resolve(JSON.parse(body));
                    } catch (e) { resolve(null); }
                });
            }).on('error', () => resolve(null));
        });
    };

    // Razorpay search by bankcode, city, state
    const searchBanks = (params) => {
        return new Promise((resolve) => {
            let url = 'https://ifsc.razorpay.com/search?';
            if (params.bankcode) url += `bankcode=${params.bankcode}&`;
            if (params.city) url += `city=${encodeURIComponent(params.city)}&`;
            if (params.state) url += `state=${encodeURIComponent(params.state)}&`;
            url += 'limit=20';

            https.get(url, (response) => {
                let body = '';
                response.on('data', (chunk) => (body += chunk));
                response.on('end', () => {
                    try {
                        if (response.statusCode === 200) resolve(JSON.parse(body));
                        else resolve(null);
                    } catch (e) { resolve(null); }
                });
            }).on('error', () => resolve(null));
        });
    };

    // 2. Fuzzy Bank Search API (astro-dally/Bankapi)
    // Note: Since this is a Next.js API, we'll simulate fuzzy search locally
    // For production, you would call: https://bankapi.vercel.app/api/search?q=HDFC
    const fuzzySearchBank = (query) => {
        return new Promise((resolve) => {
            // Use Razorpay's search as base, but with fuzzy matching on bank names
            const bankCodes = {
                'sbi': 'SBIN', 'state bank': 'SBIN', 'state bank of india': 'SBIN',
                'hdfc': 'HDFC', 'icici': 'ICICI', 'axis': 'UTIB', 'axis bank': 'UTIB',
                'kotak': 'KKBK', 'kotak mahindra': 'KKBK', 'yes bank': 'YESB', 'yes': 'YESB',
                'pnb': 'PUNB', 'punjab national bank': 'PUNB',
                'canara bank': 'CNRB', 'canara': 'CNRB',
                'bank of baroda': 'BARB', 'baroda': 'BARB',
                'idbi': 'IDBI', 'idbi bank': 'IDBI',
                'indian bank': 'IDIB', 'indian': 'IDIB',
                'indian overseas': 'IOBA', 'indian overseas bank': 'IOBA',
                'union bank': 'UBIN', 'union': 'UBIN',
                'uco bank': 'UCBA', 'uco': 'UCBA',
                'central bank': 'CBIN', 'central': 'CBIN',
                'karur vysya': 'KVBL', 'kvbl': 'KVBL',
                'south indian bank': 'SIBL', 'sib': 'SIBL',
                'dhanlaxmi': 'DLXB', 'dlxb': 'DLXB',
                'federal bank': 'FDRL', 'federal': 'FDRL',
                'indusind': 'INDB', 'indusind bank': 'INDB'
            };

            const searchTerm = query.toLowerCase().trim();
            let bestMatch = null;
            let bestScore = 0;

            // Fuzzy matching - find closest bank name
            for (const [key, code] of Object.entries(bankCodes)) {
                // Simple substring match with priority
                let score = 0;
                if (key.includes(searchTerm) || searchTerm.includes(key)) {
                    score = 10;
                } else if (searchTerm.length > 2 && key.substring(0, searchTerm.length) === searchTerm) {
                    score = 8;
                } else if (searchTerm.length > 3 && key.includes(searchTerm.substring(0, 3))) {
                    score = 5;
                } else if (searchTerm.length > 2 && key.includes(searchTerm.substring(0, 2))) {
                    score = 3;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = { bankCode: code, bankName: key };
                }
            }

            if (bestMatch && bestScore > 2) {
                resolve(bestMatch);
            } else {
                // Try partial match on first 4 letters
                if (searchTerm.length >= 4) {
                    const guessedCode = searchTerm.substring(0, 4).toUpperCase();
                    resolve({ bankCode: guessedCode, bankName: query });
                } else {
                    resolve(null);
                }
            }
        });
    };

    // 3. Bank Search API (sameerkumar18 style) - Fetch IFSC/MICR by branch
    // Integrated with Razorpay's search

    const escapeHtml = (text) => {
        if (!text) return 'N/A';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    // ============ HANDLE CALLBACK QUERY (Button Click) ============
    if (callback_query) {
        await answerCallback(callback_query.id);
        const data = callback_query.data;
        const chatId = callback_query.message.chat.id;
        const messageId = callback_query.message.message_id;

        if (data.startsWith('ifsc_')) {
            const ifscCode = data.replace('ifsc_', '');
            const bankData = await fetchBankData(ifscCode);

            if (bankData) {
                const details = `🏛 <b>BANK DETAILS</b> 🏛\n\n` +
                    `• <b>Bank Name:</b> ${escapeHtml(bankData.BANK)}\n` +
                    `• <b>Branch:</b> ${escapeHtml(bankData.BRANCH)}\n` +
                    `• <b>IFSC Code:</b> ${escapeHtml(bankData.IFSC)}\n` +
                    `• <b>MICR Code:</b> ${escapeHtml(bankData.MICR || 'Not Available')}\n` +
                    `• <b>SWIFT Code:</b> ${escapeHtml(bankData.SWIFT || 'Not Available')}\n` +
                    `• <b>Address:</b> ${escapeHtml(bankData.ADDRESS)}\n` +
                    `• <b>City:</b> ${escapeHtml(bankData.CITY)}\n` +
                    `• <b>State:</b> ${escapeHtml(bankData.STATE)}\n` +
                    `• <b>Contact:</b> ${escapeHtml(bankData.CONTACT)}\n\n` +
                    `⚡ <b>Services:</b>\n` +
                    `• UPI: ${bankData.UPI ? '✅' : '❌'}\n` +
                    `• IMPS: ${bankData.IMPS ? '✅' : '❌'}\n` +
                    `• NEFT: ${bankData.NEFT ? '✅' : '❌'}\n` +
                    `• RTGS: ${bankData.RTGS ? '✅' : '❌'}\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🤖 Powered By @Introspection007`;

                await editMessage({
                    chat_id: chatId,
                    message_id: messageId,
                    text: details,
                    parse_mode: 'HTML'
                });
            }
        } else if (data === 'search_again') {
            await editMessage({
                chat_id: chatId,
                message_id: messageId,
                text: `🔍 **Search Again**

Send me a bank name (e.g., HDFC, SBI, ICICI).

Or type:
• /search [city] - Find branches by city
• /search [bank] [city] - Find specific bank in a city

━━━━━━━━━━━━━━━━━━━━━
🤖 Powered By @Introspection007`,
                parse_mode: 'Markdown'
            });
        }
        return res.status(200).send('OK');
    }

    // ============ HANDLE TEXT MESSAGES ============
    const { message } = req.body || {};
    if (!message || !message.text) {
        return res.status(200).send('OK');
    }

    const chatId = message.chat.id;
    const incomingText = message.text.trim();

    // ============ COMMANDS ============
    if (incomingText === '/start') {
        const welcome = `🏦 **Bank IFSC Finder - Enhanced**

Just type a **bank name** (e.g., HDFC, SBI, ICICI).

I'll show you all branches as buttons. Tap any for full details!

**Features:**
• 🔍 Fuzzy search - handles typos
• 📍 Search by city: /search Mumbai
• 📍 Search by bank & city: /search HDFC Mumbai

━━━━━━━━━━━━━━━━━━━━━
🤖 Powered By @Introspection007`;

        await postToTelegram({ chat_id: chatId, text: welcome, parse_mode: 'Markdown' });
        return res.status(200).send('OK');
    }

    // ============ /search COMMAND ============
    if (incomingText.startsWith('/search')) {
        const parts = incomingText.split(' ');
        const query = parts.slice(1).join(' ');

        if (!query) {
            await postToTelegram({
                chat_id: chatId,
                text: `🔍 **Search Usage**

/search Mumbai - Find all branches in Mumbai
/search HDFC Mumbai - Find HDFC branches in Mumbai

━━━━━━━━━━━━━━━━━━━━━
🤖 Powered By @Introspection007`,
                parse_mode: 'Markdown'
            });
            return res.status(200).send('OK');
        }

        // Check if it's "bank city" format
        const bankCodes = {
            'sbi': 'SBIN', 'state bank': 'SBIN', 'hdfc': 'HDFC',
            'icici': 'ICICI', 'axis': 'UTIB', 'axis bank': 'UTIB',
            'kotak': 'KKBK', 'yes bank': 'YESB', 'yes': 'YESB',
            'pnb': 'PUNB', 'canara': 'CNRB', 'canara bank': 'CNRB',
            'baroda': 'BARB', 'bank of baroda': 'BARB', 'idbi': 'IDBI',
            'union bank': 'UBIN', 'union': 'UBIN', 'uco': 'UCBA'
        };

        // Try to detect bank and city
        let bankCode = null;
        let city = query;

        for (const [key, code] of Object.entries(bankCodes)) {
            if (query.toLowerCase().includes(key)) {
                bankCode = code;
                city = query.replace(new RegExp(key, 'i'), '').trim();
                break;
            }
        }

        const searchParams = {};
        if (bankCode) searchParams.bankcode = bankCode;
        if (city && city.length > 1) searchParams.city = city;

        const results = await searchBanks(searchParams);

        if (!results || results.length === 0) {
            await postToTelegram({
                chat_id: chatId,
                text: `🔍 No branches found for '${query}'.

Try: /search Mumbai
Try: /search HDFC Mumbai

━━━━━━━━━━━━━━━━━━━━━
🤖 Powered By @Introspection007`
            });
            return res.status(200).send('OK');
        }

        await sendBranchButtons(chatId, `📍 **${query.toUpperCase()}**`, results);
        return res.status(200).send('OK');
    }

    // ============ CHECK IF IFSC CODE ============
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
    if (ifscRegex.test(incomingText)) {
        const data = await fetchBankData(incomingText);
        if (!data) {
            await postToTelegram({
                chat_id: chatId,
                text: `❌ IFSC ${incomingText.toUpperCase()} not found.\n\n━━━━━━━━━━━━━━━━━━━━━\n🤖 Powered By @Introspection007`
            });
            return res.status(200).send('OK');
        }

        const details = `🏛 <b>BANK DETAILS</b> 🏛\n\n` +
            `• <b>Bank Name:</b> ${escapeHtml(data.BANK)}\n` +
            `• <b>Branch:</b> ${escapeHtml(data.BRANCH)}\n` +
            `• <b>IFSC:</b> ${escapeHtml(data.IFSC)}\n` +
            `• <b>MICR:</b> ${escapeHtml(data.MICR || 'N/A')}\n` +
            `• <b>SWIFT:</b> ${escapeHtml(data.SWIFT || 'N/A')}\n` +
            `• <b>Address:</b> ${escapeHtml(data.ADDRESS)}\n` +
            `• <b>City:</b> ${escapeHtml(data.CITY)}\n` +
            `• <b>State:</b> ${escapeHtml(data.STATE)}\n` +
            `• <b>Contact:</b> ${escapeHtml(data.CONTACT)}\n\n` +
            `⚡ UPI: ${data.UPI ? '✅' : '❌'} | IMPS: ${data.IMPS ? '✅' : '❌'}\n` +
            `NEFT: ${data.NEFT ? '✅' : '❌'} | RTGS: ${data.RTGS ? '✅' : '❌'}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n🤖 Powered By @Introspection007`;

        await postToTelegram({ chat_id: chatId, text: details, parse_mode: 'HTML' });
        return res.status(200).send('OK');
    }

    // ============ FUZZY BANK SEARCH ============
    const fuzzyResult = await fuzzySearchBank(incomingText);

    if (!fuzzyResult) {
        await postToTelegram({
            chat_id: chatId,
            text: `🔍 Couldn't find bank '${incomingText}'.

**Try:**
• HDFC
• SBI
• ICICI
• Axis
• Canara Bank

Or use: /search Mumbai

━━━━━━━━━━━━━━━━━━━━━
🤖 Powered By @Introspection007`,
            parse_mode: 'Markdown'
        });
        return res.status(200).send('OK');
    }

    // Search by bank code
    const searchParams = { bankcode: fuzzyResult.bankCode };
    const results = await searchBanks(searchParams);

    if (!results || results.length === 0) {
        await postToTelegram({
            chat_id: chatId,
            text: `🔍 No branches found for '${incomingText}'.

Try a different bank name or use /search [city]

━━━━━━━━━━━━━━━━━━━━━
🤖 Powered By @Introspection007`
        });
        return res.status(200).send('OK');
    }

    await sendBranchButtons(chatId, `🏦 **${fuzzyResult.bankName.toUpperCase()} Branches**`, results);

    // ============ HELPER FUNCTION TO SEND BRANCH BUTTONS ============
    async function sendBranchButtons(chatId, headerText, results) {
        let replyText = `${headerText}\n\nTap a branch to get details:\n\n━━━━━━━━━━━━━━━━━━━━━\n🤖 Powered By @Introspection007`;

        const keyboard = { inline_keyboard: [] };

        for (let i = 0; i < Math.min(results.length, 15); i++) {
            const branch = results[i];
            const label = `${branch.BRANCH} (${branch.CITY})`;
            const callbackData = `ifsc_${branch.IFSC}`;
            keyboard.inline_keyboard.push([{ text: label, callback_data: callbackData }]);
        }

        keyboard.inline_keyboard.push([{ text: "🔄 New Search", callback_data: "search_again" }]);

        await postToTelegram({
            chat_id: chatId,
            text: replyText,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    return res.status(200).send('OK');
};
