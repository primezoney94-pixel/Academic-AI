const express = require('express');
const router = express.Router();
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { WORK_TYPES } = require('../config/workTypes');
const { generateContent } = require('../services/claudeService');
const { generatePresentationImages } = require('../services/gptService');
const { createDocx } = require('../services/docxService');
const { createPptx } = require('../services/pptxService');
const { recordGeneration, recordError } = require('../utils/stats');
const { sanitizeFilename } = require('../utils/helpers');
const logger = require('../utils/logger');

const OUTPUT_DIR = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.join(__dirname, '..', 'outputs');

// ── Bot instance ───────────────────────────────────────────────────────────
let bot;
try {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
} catch (e) {
  logger.error('Telegram bot yaratilmadi:', e.message);
}

// ── In-memory session store ────────────────────────────────────────────────
// Production da Redis ishlatish tavsiya etiladi
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) sessions.set(chatId, {});
  return sessions.get(chatId);
}
function clearSession(chatId) { sessions.delete(chatId); }

// ── Webhook ────────────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Telegram 200 kutadi — tez javob ber
  if (!bot) return;

  const update = req.body;
  try {
    if (update.message) await handleMessage(update.message);
    else if (update.callback_query) await handleCallback(update.callback_query);
  } catch (err) {
    logger.error('Webhook xatosi:', err.message);
  }
});

// ── Webhook o'rnatish ──────────────────────────────────────────────────────
router.post('/setup', async (req, res) => {
  if (!bot) return res.status(500).json({ error: 'Bot token yo\'q' });
  try {
    const url = `${process.env.BASE_URL}/api/telegram/webhook`;
    await bot.setWebHook(url);
    const info = await bot.getWebHookInfo();
    logger.info('Webhook o\'rnatildi:', url);
    res.json({ success: true, webhook: url, info });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Message handler ────────────────────────────────────────────────────────
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const session = getSession(chatId);

  if (text === '/start' || text === '/menu') {
    clearSession(chatId);
    return sendWelcome(chatId, msg.from?.first_name);
  }
  if (text === '/help') return sendHelp(chatId);
  if (text === '/cancel') {
    clearSession(chatId);
    return bot.sendMessage(chatId, '❌ Bekor qilindi. /start bosing.', { parse_mode: 'Markdown' });
  }

  if (session.step === 'awaiting_topic') {
    if (text.length < 3) return bot.sendMessage(chatId, '⚠️ Mavzu kamida 3 ta belgi bo\'lishi kerak.');
    if (text.length > 200) return bot.sendMessage(chatId, '⚠️ Mavzu 200 ta belgidan oshmasin.');

    session.topic = text;
    session.step = 'confirm';

    const wt = WORK_TYPES.find(w => w.id === session.workTypeId);
    return bot.sendMessage(chatId,
      `✅ *Tasdiqlash*\n\n` +
      `📌 Tur: *${wt?.label}*\n` +
      `📝 Mavzu: _${text}_\n` +
      `🌐 Til: ${langLabel(session.language)}\n\n` +
      `Davom etasizmi?`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Ha, boshlash!', callback_data: 'confirm_yes' }],
            [{ text: '✏️ Mavzuni o\'zgartirish', callback_data: 'change_topic' },
             { text: '🔙 Boshqa tur', callback_data: 'restart' }]
          ]
        }
      }
    );
  }
}

// ── Callback handler ──────────────────────────────────────────────────────
async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const data = cb.data;
  const session = getSession(chatId);

  await bot.answerCallbackQuery(cb.id).catch(() => {});

  if (data === 'restart') { clearSession(chatId); return sendWelcome(chatId, cb.from?.first_name); }
  if (data === 'change_topic') {
    session.step = 'awaiting_topic';
    const wt = WORK_TYPES.find(w => w.id === session.workTypeId);
    return bot.sendMessage(chatId, `✏️ *${wt?.label}* uchun yangi mavzuni yozing:`, { parse_mode: 'Markdown' });
  }

  // Til tanlash
  if (['lang_uz', 'lang_ru', 'lang_en'].includes(data)) {
    session.language = data.replace('lang_', '');
    return sendWorkTypeMenu(chatId);
  }

  // Ish turi tanlash
  const selectedType = WORK_TYPES.find(w => w.id === data);
  if (selectedType) {
    session.workTypeId = data;
    session.step = 'awaiting_topic';
    return bot.sendMessage(chatId,
      `*${selectedType.label}* tanlandi!\n\n` +
      `📄 Hajm: ${selectedType.pages || selectedType.slides} ${selectedType.pages ? 'bet' : 'slayd'}\n` +
      `🔤 Til: ${langLabel(session.language)}\n\n` +
      `✍️ Endi *mavzuni* yozing:`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'restart' }]] }
      }
    );
  }

  if (data === 'confirm_yes') return processGeneration(chatId, session);
}

// ── Generation ────────────────────────────────────────────────────────────
async function processGeneration(chatId, session) {
  const workType = WORK_TYPES.find(w => w.id === session.workTypeId);
  if (!workType || !session.topic) {
    return bot.sendMessage(chatId, '❌ Xatolik. /start bosing.');
  }

  clearSession(chatId);
  const steps = [
    { text: '🤖 Claude matn yozmoqda...' },
    { text: workType.format === 'pptx' ? '🎨 Taqdimot yaratilmoqda...' : '📄 Word fayl tayyorlanmoqda...' },
    { text: '✅ Yakunlanmoqda...' }
  ];

  const loadMsg = await bot.sendMessage(chatId,
    `⏳ *Ishlanmoqda...*\n\n${steps[0].text}\n\n_Taxminan 1–3 daqiqa_`,
    { parse_mode: 'Markdown' }
  );

  const editStatus = async (txt) => {
    try {
      await bot.editMessageText(
        `⏳ *Ishlanmoqda...*\n\n${txt}\n\n_Iltimos kuting..._`,
        { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown' }
      );
    } catch {}
  };

  const jobId = uuidv4();
  const jobDir = path.join(OUTPUT_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    const content = await generateContent(workType, session.topic, session.language);
    await editStatus(steps[1].text);

    let outputPath;
    if (workType.format === 'pptx') {
      let imageMap = {};
      if (process.env.OPENAI_API_KEY) {
        imageMap = await generatePresentationImages(content.slides || [], session.topic, jobDir).catch(() => ({}));
      }
      outputPath = path.join(jobDir, `${sanitizeFilename(session.topic)}.pptx`);
      await createPptx(content, session.topic, outputPath, imageMap);
    } else {
      outputPath = path.join(jobDir, `${sanitizeFilename(session.topic)}.docx`);
      await createDocx(content, workType, outputPath);
    }

    await editStatus(steps[2].text);
    await bot.deleteMessage(chatId, loadMsg.message_id).catch(() => {});

    await bot.sendDocument(chatId, outputPath, {
      caption:
        `✅ *Tayyor!*\n\n` +
        `📌 ${workType.label}\n` +
        `📝 ${session.topic}\n` +
        `🌐 ${langLabel(session.language)}\n\n` +
        `_Yangi ish uchun /start_`,
      parse_mode: 'Markdown'
    });

    recordGeneration(workType.id, session.language);
    logger.info(`[${jobId}] Bot orqali yuborildi: ${session.topic}`);

    // Cleanup 30 daqiqadan keyin
    setTimeout(() => { try { fs.rmSync(jobDir, { recursive: true, force: true }); } catch {} }, 30 * 60 * 1000);

  } catch (err) {
    logger.error(`[${jobId}] Bot generation xatosi:`, err.message);
    recordError();
    try { fs.rmSync(jobDir, { recursive: true, force: true }); } catch {}

    const errMsg = err.message?.includes('overloaded')
      ? 'AI hozir band. Bir daqiqadan so\'ng /start bosing.'
      : 'Xatolik yuz berdi. Qayta urining: /start';

    await bot.editMessageText(`❌ *${errMsg}*`, {
      chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown'
    }).catch(() => bot.sendMessage(chatId, `❌ ${errMsg}`));
  }
}

// ── UI helpers ─────────────────────────────────────────────────────────────
async function sendWelcome(chatId, firstName) {
  const name = firstName ? `, ${firstName}` : '';
  await bot.sendMessage(chatId,
    `👋 Assalomu alaykum${name}!\n\n` +
    `🎓 *AI Academic Platform*\n\n` +
    `Birinchi, tilni tanlang:`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🇺🇿 O\'zbek', callback_data: 'lang_uz' },
            { text: '🇷🇺 Русский', callback_data: 'lang_ru' },
            { text: '🇬🇧 English', callback_data: 'lang_en' }
          ]
        ]
      }
    }
  );
}

async function sendWorkTypeMenu(chatId) {
  const keyboard = [];
  for (let i = 0; i < WORK_TYPES.length; i += 2) {
    const row = [{ text: WORK_TYPES[i].label, callback_data: WORK_TYPES[i].id }];
    if (WORK_TYPES[i + 1]) row.push({ text: WORK_TYPES[i + 1].label, callback_data: WORK_TYPES[i + 1].id });
    keyboard.push(row);
  }
  await bot.sendMessage(chatId,
    `📚 *Ish turini tanlang:*`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } }
  );
}

async function sendHelp(chatId) {
  await bot.sendMessage(chatId,
    `📖 *Qo\'llanma:*\n\n` +
    `1. /start — Boshlash\n` +
    `2. Tilni tanlang\n` +
    `3. Ish turini tanlang\n` +
    `4. Mavzuni yozing\n` +
    `5. Tasdiqlang va faylni oling\n\n` +
    `⏱ 1–3 daqiqa\n` +
    `❌ /cancel — Bekor qilish`,
    { parse_mode: 'Markdown' }
  );
}

function langLabel(lang) {
  return { uz: '🇺🇿 O\'zbek', ru: '🇷🇺 Rus', en: '🇬🇧 Ingliz' }[lang] || '🇺🇿 O\'zbek';
}

module.exports = router;
