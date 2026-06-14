require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const baseUrl = process.env.BASE_URL;

  if (!token) { console.error('❌ TELEGRAM_BOT_TOKEN .env da yo\'q'); process.exit(1); }
  if (!baseUrl) { console.error('❌ BASE_URL .env da yo\'q (masalan: https://your-domain.com)'); process.exit(1); }

  const bot = new TelegramBot(token, { polling: false });
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;

  console.log('📡 Webhook o\'rnatilmoqda:', webhookUrl);
  await bot.setWebHook(webhookUrl);

  const info = await bot.getWebHookInfo();
  console.log('✅ Webhook o\'rnatildi!');
  console.log('📋 Holat:', JSON.stringify(info, null, 2));
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
