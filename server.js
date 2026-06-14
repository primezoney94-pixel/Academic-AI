require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

const logger = require('./utils/logger');
const workRouter = require('./routes/work');
const telegramRouter = require('./routes/telegram');
const statsRouter = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Papkalarni yaratish ────────────────────────────────────────────────────
const OUTPUT_DIR = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.join(__dirname, 'outputs');
const LOGS_DIR = path.join(__dirname, '..', 'logs');
[OUTPUT_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Xavfsizlik middleware ──────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false // Mini App uchun
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Rate limiting ──────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Juda ko\'p so\'rov. 15 daqiqadan so\'ng qayta urining.' },
  skip: (req) => req.path === '/health' // health checkni limit qilma
});
app.use('/api/', apiLimiter);

// ── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static files ───────────────────────────────────────────────────────────
// Frontend (Mini App)
app.use('/app', express.static(path.join(__dirname, '..', 'frontend')));
// Download fayllar
app.use('/outputs', express.static(OUTPUT_DIR));

// ── Request logging ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path !== '/health') {
    logger.debug(`${req.method} ${req.path}`);
  }
  next();
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/work', workRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/stats', statsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime().toFixed(0) + 's',
    env: process.env.NODE_ENV || 'development'
  });
});

// ── Cron: Eski fayllarni tozalash (har soatda) ─────────────────────────────
cron.schedule('0 * * * *', () => {
  const ttl = parseInt(process.env.FILE_TTL_MS) || 2 * 60 * 60 * 1000;
  const now = Date.now();
  let cleaned = 0;

  try {
    const dirs = fs.readdirSync(OUTPUT_DIR);
    dirs.forEach(dir => {
      const fullPath = path.join(OUTPUT_DIR, dir);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && (now - stat.mtimeMs) > ttl) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          cleaned++;
        }
      } catch {}
    });
    if (cleaned > 0) logger.info(`Cron: ${cleaned} ta eski fayl tozalandi`);
  } catch (err) {
    logger.error('Cron tozalash xatosi:', err.message);
  }
});

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint topilmadi.' });
});

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Global xatolik:', err);
  res.status(500).json({ error: 'Serverda kutilmagan xatolik.' });
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`✅ Server ${PORT}-portda ishlamoqda`);
  logger.info(`📁 Output papka: ${OUTPUT_DIR}`);
  logger.info(`🌐 Frontend: http://localhost:${PORT}/app`);
  logger.info(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
  if (!process.env.CLAUDE_API_KEY) logger.warn('⚠️  CLAUDE_API_KEY topilmadi!');
  if (!process.env.TELEGRAM_BOT_TOKEN) logger.warn('⚠️  TELEGRAM_BOT_TOKEN topilmadi!');
  if (!process.env.OPENAI_API_KEY) logger.info('ℹ️  OPENAI_API_KEY yo\'q — rasmlar o\'chirilgan');
});

module.exports = app;
