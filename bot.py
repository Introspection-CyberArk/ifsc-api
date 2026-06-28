import os
import json
import requests
from flask import Flask, request, jsonify
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes, MessageHandler, filters

app = Flask(__name__)

# ============ CONFIGURATION ============
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")

# Using Razorpay's IFSC API for search and lookup
# Documentation: https://github.com/razorpay/ifsc-api
IFSC_API_BASE = "https://ifsc.razorpay.com"

# Bank name to bank code mapping
# This helps convert "HDFC" to "HDFC" etc.
# For the search API, we can use bankcode parameter

# ============ COMMAND HANDLERS ============

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send welcome message"""
    await update.message.reply_text(
        "🏦 **IFSC Code Finder**\n\n"
        "Just type a **bank name** and I'll show you all IFSC codes!\n\n"
        "**Examples:**\n"
        "• `HDFC`\n"
        "• `SBI`\n"
        "• `ICICI`\n"
        "• `Canara Bank`\n\n"
        "You can also send an IFSC code to get bank details.\n\n"
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "🤖 **Powered By @Introspection007**",
        parse_mode="Markdown"
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show help message"""
    await update.message.reply_text(
        "🏦 **How to use:**\n\n"
        "1️⃣ Type a **bank name** (e.g., `HDFC`, `SBI`, `ICICI`)\n"
        "2️⃣ I'll show up to 10 IFSC codes for that bank\n"
        "3️⃣ Click any IFSC code to see full details\n\n"
        "🔍 **Or send an IFSC code** for instant details!\n\n"
        "Example: `HDFC0000001`\n\n"
        "━━━━━━━━━━━━━━━━━━━━━\n"
        "🤖 **Powered By @Introspection007**",
        parse_mode="Markdown"
    )

async def fetch_ifsc_details(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Fetch and display IFSC details for a specific code"""
    user_input = update.message.text.strip().upper()
    
    # Check if it's an IFSC code (11 characters, first 4 letters, last 7 alphanumeric)
    is_ifsc = len(user_input) == 11 and user_input[:4].isalpha() and user_input[4:].isalnum()
    
    if is_ifsc:
        # User sent an IFSC code - get bank details
        await handle_ifsc_lookup(update, user_input)
    else:
        # User sent a bank name - search for banks
        await handle_bank_search(update, user_input)

async def handle_ifsc_lookup(update: Update, ifsc_code: str):
    """Look up a specific IFSC code"""
    await update.message.reply_chat_action(action="typing")
    
    try:
        response = requests.get(f"{IFSC_API_BASE}/{ifsc_code}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            reply = f"🏦 **Bank Details**\n\n"
            reply += f"🏛️ **Bank:** {data.get('BANK', 'N/A')}\n"
            reply += f"📍 **Branch:** {data.get('BRANCH', 'N/A')}\n"
            reply += f"🔢 **IFSC:** `{data.get('IFSC', 'N/A')}`\n"
            reply += f"🏠 **Address:** {data.get('ADDRESS', 'N/A')}\n"
            reply += f"📌 **Contact:** {data.get('CONTACT', 'N/A')}\n"
            reply += f"📍 **City:** {data.get('CITY', 'N/A')}\n"
            reply += f"📮 **State:** {data.get('STATE', 'N/A')}\n"
            reply += f"💳 **MICR:** {data.get('MICR', 'N/A')}\n"
            reply += f"✅ **UPI:** {'Yes' if data.get('UPI') else 'No'}\n"
            reply += f"✅ **NEFT:** {'Yes' if data.get('NEFT') else 'No'}\n"
            reply += f"✅ **RTGS:** {'Yes' if data.get('RTGS') else 'No'}\n"
            reply += f"✅ **IMPS:** {'Yes' if data.get('IMPS') else 'No'}\n\n"
            reply += "━━━━━━━━━━━━━━━━━━━━━\n"
            reply += "🤖 **Powered By @Introspection007**"
            
            await update.message.reply_text(reply, parse_mode="Markdown")
            
        elif response.status_code == 404:
            await update.message.reply_text(
                f"❌ **IFSC Code Not Found**\n\n"
                f"`{ifsc_code}` is not a valid IFSC code.\n\n"
                "Please check and try again.\n\n"
                "━━━━━━━━━━━━━━━━━━━━━\n"
                "🤖 **Powered By @Introspection007**",
                parse_mode="Markdown"
            )
        else:
            await update.message.reply_text(
                "⚠️ **Service Unavailable**\n\n"
                "Please try again later.\n\n"
                "━━━━━━━━━━━━━━━━━━━━━\n"
                "🤖 **Powered By @Introspection007**",
                parse_mode="Markdown"
            )
            
    except Exception as e:
        await update.message.reply_text(
            f"⚠️ **Error:** {str(e)[:100]}\n\n"
            "Please try again later.\n\n"
            "━━━━━━━━━━━━━━━━━━━━━\n"
            "🤖 **Powered By @Introspection007**",
            parse_mode="Markdown"
        )

async def handle_bank_search(update: Update, bank_name: str):
    """Search for banks by name and show IFSC codes"""
    await update.message.reply_chat_action(action="typing")
    
    try:
        # Using Razorpay's search endpoint with bankcode parameter
        # First, try to find bank code from name
        # We'll use the /search endpoint with bankcode
        # For demo, we'll search using a common bank name approach
        # Note: The Razorpay API requires bankcode, not bank name directly
        
        # Approach: Use the /banks endpoint to get bank codes, then search
        # For simplicity in this bot, we'll use a direct approach with common banks
        
        # Since Razorpay's search API requires bankcode, we'll use a mapping
        # or use the fact that many banks use their short name as bankcode
        
        # Common bank codes
        bank_codes = {
            "sbi": "SBIN",
            "state bank of india": "SBIN",
            "hdfc": "HDFC",
            "icici": "ICICI",
            "axis": "UTIB",
            "bank of baroda": "BARB",
            "punjab national bank": "PUNB",
            "canara bank": "CNRB",
            "kotak mahindra": "KKBK",
            "yes bank": "YESB",
            "idbi": "IDBI",
            "bank of india": "BKID",
            "indian overseas bank": "IOBA",
            "indian bank": "IDIB",
            "union bank of india": "UBIN",
            "central bank of india": "CBIN",
            "uco bank": "UCBA",
            "pank of maharashtra": "MAHB"
        }
        
        search_term = bank_name.lower().strip()
        bank_code = None
        
        for key, code in bank_codes.items():
            if key in search_term or search_term in key:
                bank_code = code
                break
        
        if not bank_code:
            # Try to find using first few letters
            if len(search_term) >= 2:
                bank_code = search_term[:4].upper()
        
        if bank_code:
            # Search using bankcode
            search_url = f"{IFSC_API_BASE}/search?bankcode={bank_code}&limit=10"
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
                        reply += f"   Address: {branch.get('ADDRESS', 'N/A')[:50]}...\n\n"
                    
                    reply += "━━━━━━━━━━━━━━━━━━━━━\n"
                    reply += "💡 Send any IFSC code to get full details!\n\n"
                    reply += "🤖 **Powered By @Introspection007**"
                    
                    await update.message.reply_text(reply, parse_mode="Markdown")
                else:
                    # If no results, try a more flexible search
                    await update.message.reply_text(
                        f"🔍 **No branches found for '{bank_name}'**\n\n"
                        "Try using a different bank name.\n\n"
                        "**Examples:**\n"
                        "• `HDFC`\n"
                        "• `SBI`\n"
                        "• `ICICI`\n"
                        "• `Canara Bank`\n\n"
                        "Or send an IFSC code directly!\n\n"
                        "━━━━━━━━━━━━━━━━━━━━━\n"
                        "🤖 **Powered By @Introspection007**",
                        parse_mode="Markdown"
                    )
            else:
                # Fallback: Suggest common banks
                await update.message.reply_text(
                    f"🔍 **Searching for '{bank_name}'**\n\n"
                    "I couldn't find results. Try these banks:\n\n"
                    "• `HDFC`\n• `SBI`\n• `ICICI`\n• `Axis`\n"
                    "• `Canara Bank`\n• `Kotak`\n• `Yes Bank`\n\n"
                    "Or send an IFSC code directly!\n\n"
                    "━━━━━━━━━━━━━━━━━━━━━\n"
                    "🤖 **Powered By @Introspection007**",
                    parse_mode="Markdown"
                )
        else:
            # No matching bank code
            await update.message.reply_text(
                f"🔍 **Searching for '{bank_name}'**\n\n"
                "I couldn't find that bank. Try these:\n\n"
                "• `HDFC`\n• `SBI`\n• `ICICI`\n• `Axis`\n"
                "• `Canara Bank`\n• `Kotak`\n• `Yes Bank`\n\n"
                "Or send an IFSC code directly!\n\n"
                "━━━━━━━━━━━━━━━━━━━━━\n"
                "🤖 **Powered By @Introspection007**",
                parse_mode="Markdown"
            )
            
    except Exception as e:
        await update.message.reply_text(
            f"⚠️ **Error:** {str(e)[:100]}\n\n"
            "Please try again later.\n\n"
            "━━━━━━━━━━━━━━━━━━━━━\n"
            "🤖 **Powered By @Introspection007**",
            parse_mode="Markdown"
        )

# ============ FLASK WEBHOOK ============

telegram_app = Application.builder().token(TOKEN).build()

# Register handlers
telegram_app.add_handler(CommandHandler("start", start))
telegram_app.add_handler(CommandHandler("help", help_command))
telegram_app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, fetch_ifsc_details))

@app.route(f"/webhook/{TOKEN}", methods=["POST"])
async def webhook():
    try:
        update = Update.de_json(request.get_json(force=True), telegram_app.bot)
        await telegram_app.process_update(update)
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

if __name__ == "__main__":
    app.run()
