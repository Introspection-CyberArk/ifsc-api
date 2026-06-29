import os
import json
import requests
from flask import Flask, request, jsonify
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

app = Flask(__name__)

# ============ CONFIGURATION ============
TOKEN = "8749202267:AAG9KNIY4duOid7z6l_nuzV9_jVLOBAZztE"
IFSC_API_URL = "https://ifsc.razorpay.com"

# Free bank search API (no API key required)
# Using a combination of sources for bank data
BANK_SEARCH_API = "https://bank-search-api.vercel.app/api"

# Bank name mapping for common banks
BANK_CODES = {
    "sbi": "SBIN",
    "state bank": "SBIN",
    "state bank of india": "SBIN",
    "hdfc": "HDFC",
    "icici": "ICICI",
    "axis": "UTIB",
    "axis bank": "UTIB",
    "kotak": "KKBK",
    "kotak mahindra": "KKBK",
    "yes bank": "YESB",
    "yes": "YESB",
    "bank of baroda": "BARB",
    "baroda": "BARB",
    "pnb": "PUNB",
    "punjab national bank": "PUNB",
    "canara bank": "CNRB",
    "canara": "CNRB",
    "idbi": "IDBI",
    "idbi bank": "IDBI",
    "indian bank": "IDIB",
    "indian": "IDIB",
    "indian overseas bank": "IOBA",
    "indian overseas": "IOBA",
    "union bank": "UBIN",
    "union": "UBIN",
    "uco bank": "UCBA",
    "uco": "UCBA",
    "central bank": "CBIN",
    "central": "CBIN",
    "bank of maharashtra": "MAHB",
    "maharashtra": "MAHB",
    "karur vysya": "KVBL",
    "kvbl": "KVBL",
    "south indian bank": "SIBL",
    "sib": "SIBL",
    "dhanlaxmi": "DLXB",
    "dlxb": "DLXB"
}

# ============ TELEGRAM BOT SETUP ============
telegram_app = Application.builder().token(TOKEN).build()

# ============ COMMAND HANDLERS ============

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send welcome message"""
    await update.message.reply_text(
        "🏦 **Bank Code Finder**\n\n"
        "Just type a **bank name** and I'll show you IFSC codes!\n\n"
        "**Examples:**\n"
        "• `HDFC`\n"
        "• `SBI`\n"
        "• `ICICI`\n"
        "• `Canara Bank`\n\n"
        "Or send an IFSC code like `HDFC0000001`\n\n"
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "🤖 **Powered By @Introspection007**",
        parse_mode="Markdown"
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show help message"""
    await update.message.reply_text(
        "🏦 **How to use:**\n\n"
        "1️⃣ Type a **bank name** (e.g., `HDFC`, `SBI`)\n"
        "2️⃣ Or send an **IFSC code** for details\n\n"
        "**Examples:**\n"
        "• Bank: `HDFC` → Shows HDFC branches with IFSC\n"
        "• IFSC: `HDFC0000001` → Full bank details\n\n"
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "🤖 **Powered By @Introspection007**",
        parse_mode="Markdown"
    )

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle all text messages - detect bank name or IFSC"""
    user_input = update.message.text.strip().upper()
    await update.message.reply_chat_action(action="typing")

    # Check if it's an IFSC code (11 chars, first 4 letters)
    is_ifsc = len(user_input) == 11 and user_input[:4].isalpha() and user_input[4:].isalnum()
    
    if is_ifsc:
        # User sent an IFSC code
        await handle_ifsc(update, user_input)
    else:
        # User sent a bank name - search for it
        await search_bank_by_name(update, user_input)

async def search_bank_by_name(update: Update, bank_name: str):
    """Search for banks by name and show IFSC codes"""
    try:
        search_term = bank_name.lower().strip()
        bank_code = None
        
        # Check if we have a mapping for this bank
        for key, code in BANK_CODES.items():
            if key in search_term or search_term in key:
                bank_code = code
                break
        
        if not bank_code:
            # Try using the first 4 letters as bank code
            if len(search_term) >= 4:
                bank_code = search_term[:4].upper()
        
        if bank_code:
            # Search for branches using the bank code
            search_url = f"{IFSC_API_URL}/search?bankcode={bank_code}&limit=15"
            response = requests.get(search_url, timeout=10)
            
            if response.status_code == 200:
                results = response.json()
                if results and len(results) > 0:
                    # Format results
                    reply = f"🏦 **Branches for {bank_name.upper()}**\n\n"
                    
                    for i, branch in enumerate(results[:10], 1):
                        reply += f"{i}. **{branch.get('BRANCH', 'N/A')}**\n"
                        reply += f"   IFSC: `{branch.get('IFSC', 'N/A')}`\n"
                        reply += f"   City: {branch.get('CITY', 'N/A')}\n"
                        reply += f"   Address: {branch.get('ADDRESS', 'N/A')[:60]}...\n\n"
                    
                    if len(results) > 10:
                        reply += f"*Showing 10 of {len(results)} branches*\n\n"
                    
                    reply += "━━━━━━━━━━━━━━━━━━━━━\n"
                    reply += "💡 Send any IFSC code for full details!\n\n"
                    reply += "🤖 **Powered By @Introspection007**"
                    
                    await update.message.reply_text(reply, parse_mode="Markdown")
                else:
                    await no_results_found(update, bank_name)
            else:
                await no_results_found(update, bank_name)
        else:
            await no_results_found(update, bank_name)
            
    except Exception as e:
        await update.message.reply_text(
            f"⚠️ Error searching for '{bank_name}': {str(e)[:100]}\n\n"
            "Please try again with a valid bank name or IFSC code.\n\n"
            "━━━━━━━━━━━━━━━━━━━━━\n"
            "🤖 **Powered By @Introspection007**",
            parse_mode="Markdown"
        )

async def no_results_found(update: Update, bank_name: str):
    """Send no results message with suggestions"""
    await update.message.reply_text(
        f"🔍 **No branches found for '{bank_name}'**\n\n"
        "Try these common bank names:\n"
        "• `HDFC`\n"
        "• `SBI`\n"
        "• `ICICI`\n"
        "• `Axis`\n"
        "• `Canara Bank`\n"
        "• `Kotak`\n"
        "• `Yes Bank`\n\n"
        "Or send an IFSC code directly!\n\n"
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "🤖 **Powered By @Introspection007**",
        parse_mode="Markdown"
    )

async def handle_ifsc(update: Update, ifsc_code: str):
    """Fetch and display IFSC code details"""
    try:
        response = requests.get(f"{IFSC_API_URL}/{ifsc_code}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            reply = f"🏦 **IFSC Code Details**\n\n"
            reply += f"🏛️ **Bank:** {data.get('BANK', 'N/A')}\n"
            reply += f"📍 **Branch:** {data.get('BRANCH', 'N/A')}\n"
            reply += f"🔢 **IFSC:** `{data.get('IFSC', 'N/A')}`\n"
            reply += f"🏠 **Address:** {data.get('ADDRESS', 'N/A')}\n"
            reply += f"📍 **City:** {data.get('CITY', 'N/A')}\n"
            reply += f"📮 **State:** {data.get('STATE', 'N/A')}\n"
            reply += f"📞 **Contact:** {data.get('CONTACT', 'N/A')}\n"
            reply += f"💳 **MICR:** {data.get('MICR', 'N/A')}\n"
            reply += f"🔗 **SWIFT:** {data.get('SWIFT', 'N/A')}\n\n"
            reply += "✅ **Services:**\n"
            reply += f"• NEFT: {'✅' if data.get('NEFT') else '❌'}\n"
            reply += f"• RTGS: {'✅' if data.get('RTGS') else '❌'}\n"
            reply += f"• IMPS: {'✅' if data.get('IMPS') else '❌'}\n"
            reply += f"• UPI: {'✅' if data.get('UPI') else '❌'}\n\n"
            reply += "━━━━━━━━━━━━━━━━━━━━━\n"
            reply += "🤖 **Powered By @Introspection007**"
            
            await update.message.reply_text(reply, parse_mode="Markdown")
        else:
            await update.message.reply_text(
                f"❌ IFSC code `{ifsc_code}` not found.\n\n"
                "Please check and try again.\n\n"
                "━━━━━━━━━━━━━━━━━━━━━\n"
                "🤖 **Powered By @Introspection007**",
                parse_mode="Markdown"
            )
    except Exception as e:
        await update.message.reply_text(
            f"⚠️ Error: {str(e)[:100]}\n\n"
            "Please try again later.\n\n"
            "━━━━━━━━━━━━━━━━━━━━━\n"
            "🤖 **Powered By @Introspection007**",
            parse_mode="Markdown"
        )

# ============ REGISTER HANDLERS ============
telegram_app.add_handler(CommandHandler("start", start))
telegram_app.add_handler(CommandHandler("help", help_command))
telegram_app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

# ============ FLASK WEBHOOK ROUTE ============
@app.route(f"/webhook/{TOKEN}", methods=["POST"])
def webhook():
    try:
        update = Update.de_json(request.get_json(force=True), telegram_app.bot)
        telegram_app.process_update(update)
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"status": "error"}), 500

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "status": "Bank Code Finder Bot is running!",
        "creator": "@Introspection007"
    })

# ============ SETUP WEBHOOK ON STARTUP ============
def set_webhook():
    vercel_url = os.environ.get("VERCEL_URL")
    if vercel_url:
        webhook_url = f"https://{vercel_url}/webhook/{TOKEN}"
        telegram_app.bot.set_webhook(url=webhook_url)
        print(f"✅ Webhook set to: {webhook_url}")

if os.environ.get("VERCEL"):
    set_webhook()

if __name__ == "__main__":
    app.run()
