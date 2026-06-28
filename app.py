import os
import json
import requests
from flask import Flask, request, jsonify
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

app = Flask(__name__)

# ============ CONFIGURATION ============
TOKEN = "8749202267:AAG9KNIY4duOid7z6l_nuzV9_jVLOBAZztE"
IFSC_API_BASE = "https://ifsc.razorpay.com"

# ============ TELEGRAM BOT SETUP ============
telegram_app = Application.builder().token(TOKEN).build()

# ============ COMMAND HANDLERS ============

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send welcome message"""
    await update.message.reply_text(
        "🏦 **IFSC Code Finder**\n\n"
        "Just type a **bank name** and I'll show you IFSC codes!\n\n"
        "**Examples:**\n"
        "• `HDFC`\n"
        "• `SBI`\n"
        "• `ICICI`\n\n"
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
        "Example: `HDFC0000001`\n\n"
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "🤖 **Powered By @Introspection007**",
        parse_mode="Markdown"
    )

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle all text messages - bank search or IFSC lookup"""
    user_input = update.message.text.strip().upper()
    await update.message.reply_chat_action(action="typing")
    
    # Check if it's an IFSC code (11 chars, first 4 letters)
    is_ifsc = len(user_input) == 11 and user_input[:4].isalpha() and user_input[4:].isalnum()
    
    if is_ifsc:
        # Look up IFSC code
        try:
            response = requests.get(f"{IFSC_API_BASE}/{user_input}", timeout=10)
            if response.status_code == 200:
                data = response.json()
                reply = f"🏦 **Bank Details**\n\n"
                reply += f"🏛️ **Bank:** {data.get('BANK', 'N/A')}\n"
                reply += f"📍 **Branch:** {data.get('BRANCH', 'N/A')}\n"
                reply += f"🔢 **IFSC:** `{data.get('IFSC', 'N/A')}`\n"
                reply += f"🏠 **Address:** {data.get('ADDRESS', 'N/A')}\n"
                reply += f"📍 **City:** {data.get('CITY', 'N/A')}\n"
                reply += f"📮 **State:** {data.get('STATE', 'N/A')}\n\n"
                reply += "━━━━━━━━━━━━━━━━━━━━━\n"
                reply += "🤖 **Powered By @Introspection007**"
                await update.message.reply_text(reply, parse_mode="Markdown")
            else:
                await update.message.reply_text(
                    f"❌ IFSC code `{user_input}` not found.\n\n"
                    "━━━━━━━━━━━━━━━━━━━━━\n"
                    "🤖 **Powered By @Introspection007**",
                    parse_mode="Markdown"
                )
        except:
            await update.message.reply_text(
                "⚠️ Service unavailable. Please try again.\n\n"
                "━━━━━━━━━━━━━━━━━━━━━\n"
                "🤖 **Powered By @Introspection007**",
                parse_mode="Markdown"
            )
    else:
        # Search by bank name
        try:
            # Try to find bank code from name
            bank_codes = {
                "sbi": "SBIN", "state bank": "SBIN",
                "hdfc": "HDFC", "icici": "ICICI",
                "axis": "UTIB", "canara": "CNRB",
                "kotak": "KKBK", "yes": "YESB",
                "idbi": "IDBI", "baroda": "BARB",
                "pnb": "PUNB", "punjab national": "PUNB",
                "union": "UBIN", "uco": "UCBA",
                "indian": "IDIB", "indian overseas": "IOBA"
            }
            
            bank_code = None
            search_term = user_input.lower()
            
            for key, code in bank_codes.items():
                if key in search_term:
                    bank_code = code
                    break
            
            if bank_code:
                response = requests.get(f"{IFSC_API_BASE}/search?bankcode={bank_code}&limit=10", timeout=10)
                if response.status_code == 200:
                    results = response.json()
                    if results and len(results) > 0:
                        reply = f"🏦 **Branches for {user_input.upper()}**\n\n"
                        for i, branch in enumerate(results[:10], 1):
                            reply += f"{i}. **{branch.get('BRANCH', 'N/A')}**\n"
                            reply += f"   IFSC: `{branch.get('IFSC', 'N/A')}`\n"
                            reply += f"   City: {branch.get('CITY', 'N/A')}\n"
                            reply += f"   Address: {branch.get('ADDRESS', 'N/A')[:50]}...\n\n"
                        reply += "━━━━━━━━━━━━━━━━━━━━━\n"
                        reply += "💡 Send any IFSC code for full details!\n\n"
                        reply += "🤖 **Powered By @Introspection007**"
                        await update.message.reply_text(reply, parse_mode="Markdown")
                    else:
                        await update.message.reply_text(
                            f"🔍 No branches found for '{user_input}'.\n\n"
                            "Try: `HDFC`, `SBI`, `ICICI`\n\n"
                            "━━━━━━━━━━━━━━━━━━━━━\n"
                            "🤖 **Powered By @Introspection007**",
                            parse_mode="Markdown"
                        )
                else:
                    await update.message.reply_text(
                        f"🔍 No results for '{user_input}'.\n\n"
                        "Try: `HDFC`, `SBI`, `ICICI`\n\n"
                        "━━━━━━━━━━━━━━━━━━━━━\n"
                        "🤖 **Powered By @Introspection007**",
                        parse_mode="Markdown"
                    )
            else:
                await update.message.reply_text(
                    f"🔍 Bank '{user_input}' not found.\n\n"
                    "Try: `HDFC`, `SBI`, `ICICI`\n\n"
                    "━━━━━━━━━━━━━━━━━━━━━\n"
                    "🤖 **Powered By @Introspection007**",
                    parse_mode="Markdown"
                )
        except Exception as e:
            await update.message.reply_text(
                f"⚠️ Error: {str(e)[:100]}\n\n"
                "Please try again.\n\n"
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
    """Handle incoming Telegram updates"""
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
        "status": "IFSC Bank Search Bot is running!",
        "creator": "@Introspection007"
    })

# ============ SETUP WEBHOOK ON STARTUP ============
def set_webhook():
    """Set the webhook for this bot"""
    vercel_url = os.environ.get("VERCEL_URL")
    if vercel_url:
        webhook_url = f"https://{vercel_url}/webhook/{TOKEN}"
        telegram_app.bot.set_webhook(url=webhook_url)
        print(f"✅ Webhook set to: {webhook_url}")

# Set webhook when running on Vercel
if os.environ.get("VERCEL"):
    set_webhook()

if __name__ == "__main__":
    app.run()
