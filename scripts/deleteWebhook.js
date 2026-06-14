require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { console.error('❌ TELEGRAM_BOT_TOKEN yo\'q'); process.exit(1); }

  const bot = new TelegramBot(token, { polling: false });
  await bot.deleteWebHook();
  console.log('✅ Webhook o\'chirildi. Endi bot polling rejimida ishlaydi.');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
