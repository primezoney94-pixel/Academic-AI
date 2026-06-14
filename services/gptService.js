const OpenAI = require('openai');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

let openai = null;

function getClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * DALL-E 3 bilan rasm yaratish
 */
async function generateImage(prompt, outputPath) {
  const client = getClient();
  if (!client) throw new Error('OpenAI API key yo\'q');

  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt: `Clean professional educational infographic illustration, no text labels, minimalist design, dark background, vibrant colors: ${prompt}`,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    style: 'natural'
  });

  const imageUrl = response.data[0].url;
  await downloadFile(imageUrl, outputPath);
  logger.info(`Rasm yaratildi: ${path.basename(outputPath)}`);
  return outputPath;
}

/**
 * Taqdimot uchun bir nechta rasm yaratish
 * Xatolikda skip qilib ketaveradi — rasmlar majburiy emas
 */
async function generatePresentationImages(slides, topic, outputDir) {
  const client = getClient();
  if (!client) {
    logger.warn('OpenAI API key topilmadi — rasmlar yaratilmaydi');
    return {};
  }

  const imageMap = {};
  // Har 3-chi slayd uchun rasm yaratamiz, max 4 ta
  const targetSlides = slides
    .filter((s, i) => i > 0 && i < slides.length - 1 && i % 3 === 1)
    .slice(0, 4);

  for (const slide of targetSlides) {
    try {
      const bullets = Array.isArray(slide.content) ? slide.content : [];
      const imgPrompt = `${topic} concept: ${slide.title}. ${bullets.slice(0, 2).join('. ')}`;
      const imgPath = path.join(outputDir, `img_slide${slide.slideNumber}.png`);

      await generateImage(imgPrompt, imgPath);
      imageMap[slide.slideNumber] = imgPath;

      // Rate limit uchun kuting
      await sleep(1200);
    } catch (err) {
      logger.warn(`Slayd ${slide.slideNumber} rasmi yaratilmadi: ${err.message}`);
    }
  }

  return imageMap;
}

/**
 * URL dan fayl yuklab olish
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    const req = protocol.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(destPath); });
    });

    req.on('error', (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout: rasm yuklanmadi'));
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { generateImage, generatePresentationImages };
