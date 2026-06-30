// api/webhook.js
const https = require('https');

module.exports = async (req, res) => {
    // Only process POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end('Method Not Allowed');
    }

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

    const searchBanks = (params) => {
        return new Promise((resolve) => {
            // Note: The public Razorpay API does not host an open custom query match-all path under '/search'.
            // This simulation resolves data maps safely to prevent upstream 404 crashes.
            let url = 'https://ifsc.razorpay.com/';
            if (params.bankcode) {
                // Fetching a seed node branch directly to bypass array processing faults
                url += `${params.bankcode}0000001`;
            } else {
                resolve([]);
                return;
            }

            https.get(url, (response) => {
                let body = '';
                response.on('data', (chunk) => (body += chunk));
                response.on('end', () => {
                    try {
                        if (response.statusCode === 200) {
                            const parsed = JSON.parse(body);
                            resolve([parsed]); 
                        } else {
                            resolve([]);
                        }
                    } catch (e) { resolve([]); }
                });
            }).on('error', () => resolve([]));
        });
    };

    const fuzzySearchBank = (query) => {
        return new Promise((resolve) => {
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

            for (const [key, code] of Object.entries(bankCodes)) {
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
                if (searchTerm.length >= 4) {
                    const guessedCode = searchTerm.substring(0, 4).toUpperCase();
                    resolve({ bankCode: guessedCode, bankName: query });
                } else {
                    resolve(null);
                }
            }
        });
    };

    const escapeHtml = (text) => {
        if (!text) return 'N/A';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    async function sendBranchButtons(chatId, headerText, results) {
        let replyText = `${headerText}\n\nTap a branch to get details:\n\n━━━━━━━━━━━━━━━━━━━━━\n🤖 Powered By @Introspection007`;

        const keyboard = { inline_keyboard: [] };

        for (let i = 0; i < Math.min(results.length, 15); i++) {
            const branch = results[i];
            const label = `${branch.BRANCH || 'Main Branch'} (${branch.CITY || 'Info'})`;
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

    // ============ PARSE REQUEST BODY ============
    const body = req.body || {};
    const message = body.message;
    const callback_query = body.callback_query;

    // ============ HANDLE CALLBACK QUERY ============
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
                text: `🔍 **Search Again**\n\nSend me an exact 11-digit bank IFSC code (e.g., SBIN0001234).\n\n━━━━━━━━━━━━━━━━━━━━━\n🤖 Powered By @Introspection007`,
                parse_mode: 'Markdown'
            });
        }
        return res.status(200).send('OK');
    }

    // ============ HANDLE TEXT MESSAGES ============
    if (!message || !message.text) {
        return res.status(200).send('OK');
    }

    const chatId = message.chat.id;
    const incomingText = message.text.trim();

    // ============ COMMANDS ============
    if (incomingText === '/start') {
        const welcome = `🏦 **Bank IFSC Finder**\n\nSend me any 11-digit bank IFSC code (e.g., SBIN0001234 or HDFC0000501) to get complete branch details, MICR, and SWIFT mappings instantly.\n\n━━━━━━━━━━━━━━━━━━━━━\n🤖 Powered By @Introspection007`;
        await postToTelegram({ chat_id: chatId, text: welcome, parse_mode: 'Markdown' });
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

    // ============ FUZZY BANK SEARCH FALLBACK ============
    const fuzzyResult = await fuzzySearchBank(incomingText);
    if (!fuzzyResult) {
        await postToTelegram({
            chat_id: chatId,
            text: `🔍 Please enter a valid 11-digit IFSC code (e.g., HDFC0000501).\n\n━━━━━━━━━━━━━━━━━━━━━\n🤖 Powered By @Introspection007`
        });
        return res.status(200).send('OK');
    }

    const searchParams = { bankcode: fuzzyResult.bankCode };
    const results = await searchBanks(searchParams);

    if (!results || results.length === 0) {
        await postToTelegram({
            chat_id: chatId,
            text: `🔍 No records available for '${incomingText}'. Provide a precise IFSC key.\n\n━━━━━━━━━━━━━━━━━━━━━\n🤖 Powered By @Introspection007`
        });
        return res.status(200).send('OK');
    }

    await sendBranchButtons(chatId, `🏦 **${fuzzyResult.bankName.toUpperCase()} Records**`, results);
    return res.status(200).send('OK');
};
    
