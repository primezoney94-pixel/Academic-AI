const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { WORK_TYPES } = require('../config/workTypes');
const { generateContent } = require('../services/claudeService');
const { generatePresentationImages } = require('../services/gptService');
const { createDocx } = require('../services/docxService');
const { createPptx } = require('../services/pptxService');
const { validateGenerateRequest } = require('../middleware/validate');
const { recordGeneration, recordError } = require('../utils/stats');
const { sanitizeFilename, formatBytes } = require('../utils/helpers');
const logger = require('../utils/logger');

const OUTPUT_DIR = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.join(__dirname, '..', 'outputs');

const FILE_TTL_MS = parseInt(process.env.FILE_TTL_MS) || 2 * 60 * 60 * 1000;

// ── GET /api/work/types ────────────────────────────────────────────────────
router.get('/types', (req, res) => {
  res.json({ success: true, types: WORK_TYPES });
});

// ── POST /api/work/generate ────────────────────────────────────────────────
router.post('/generate', validateGenerateRequest, async (req, res) => {
  const { workTypeId, topic, language = 'uz', useImages = false } = req.body;

  const workType = WORK_TYPES.find(w => w.id === workTypeId);
  if (!workType) {
    return res.status(400).json({ error: `Noto'g'ri ish turi: ${workTypeId}` });
  }

  const jobId = uuidv4();
  const jobDir = path.join(OUTPUT_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  logger.info(`[${jobId}] Boshlandi: "${topic}" (${workType.label}, ${language})`);

  try {
    // Step 1 — Claude kontent yaratadi
    logger.info(`[${jobId}] Claude bilan kontent yaratilmoqda...`);
    const content = await generateContent(workType, topic, language);

    let outputFilePath;
    let imageMap = {};

    if (workType.format === 'pptx') {
      // Step 2 — DALL-E rasmlar (ixtiyoriy)
      if (useImages) {
        logger.info(`[${jobId}] DALL-E rasmlar yaratilmoqda...`);
        imageMap = await generatePresentationImages(content.slides || [], topic, jobDir);
        logger.info(`[${jobId}] ${Object.keys(imageMap).length} ta rasm yaratildi`);
      }
      // Step 3 — PPTX
      outputFilePath = path.join(jobDir, `${sanitizeFilename(topic)}.pptx`);
      logger.info(`[${jobId}] PPTX yaratilmoqda...`);
      await createPptx(content, topic, outputFilePath, imageMap);

    } else {
      // Step 2 — DOCX
      outputFilePath = path.join(jobDir, `${sanitizeFilename(topic)}.docx`);
      logger.info(`[${jobId}] DOCX yaratilmoqda...`);
      await createDocx(content, workType, outputFilePath);
    }

    const fileSize = fs.statSync(outputFilePath).size;
    const filename = path.basename(outputFilePath);
    const downloadUrl = `/outputs/${jobId}/${filename}`;
    logger.info(`[${jobId}] ✅ Tayyor: ${filename} (${formatBytes(fileSize)})`);

    // Statistika
    recordGeneration(workTypeId, language);

    // Auto-cleanup
    scheduleCleanup(jobDir, FILE_TTL_MS, jobId);

    res.json({
      success: true,
      jobId,
      downloadUrl,
      filename,
      workType: workType.label,
      topic,
      format: workType.format,
      fileSize: formatBytes(fileSize),
      expiresIn: `${Math.floor(FILE_TTL_MS / 3600000)} soat`
    });

  } catch (error) {
    logger.error(`[${jobId}] Xatolik: ${error.message}`);
    recordError();
    cleanup(jobDir);

    const msg = error.message?.includes('overloaded')
      ? 'AI hozir band. Bir daqiqadan so\'ng qayta urining.'
      : error.message?.includes('JSON')
      ? 'Kontent yaratishda xatolik. Qayta urining.'
      : 'Ish yaratishda xatolik yuz berdi.';

    res.status(500).json({
      error: msg,
      debug: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────
function scheduleCleanup(dir, delayMs, jobId) {
  setTimeout(() => {
    cleanup(dir);
    logger.info(`[${jobId}] Fayl tozalandi`);
  }, delayMs);
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

module.exports = router;
