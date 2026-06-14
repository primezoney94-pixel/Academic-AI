const PptxGenJS = require('pptxgenjs');
const fs = require('fs');
const logger = require('../utils/logger');

// ── Dark theme renk paleti ─────────────────────────────────────────────────
const C = {
  bg:       '0A0A14',
  bg2:      '12121E',
  card:     '1A1A2E',
  primary:  '6C63FF',
  cyan:     '00D4FF',
  pink:     'FF6B9D',
  green:    '00E676',
  text:     'F0F0FF',
  textSub:  'A0A0C0',
  textMuted:'606080',
  white:    'FFFFFF',
  divider:  '2A2A40',
};

async function createPptx(content, topic, outputPath, imageMap = {}) {
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_WIDE'; // 13.33" x 7.5"
  pptx.title = content.title || topic;
  pptx.subject = topic;
  pptx.author = 'AI Academic Platform';

  // Master slide
  pptx.defineSlideMaster({
    title: 'DARK_MASTER',
    background: { color: C.bg },
    objects: [
      { rect: { x: 0, y: 7.3, w: '100%', h: 0.2, fill: { color: C.primary } } },
      { text: { text: topic, options: { x: 0.3, y: 7.35, w: 8, h: 0.15, fontSize: 7, color: C.textMuted } } },
      { text: { text: new Date().getFullYear().toString(), options: { x: 12, y: 7.35, w: 1.3, h: 0.15, fontSize: 7, color: C.textMuted, align: 'right' } } },
    ]
  });

  const slides = content.slides || [];

  slides.forEach((slideData, idx) => {
    const slide = pptx.addSlide({ masterName: 'DARK_MASTER' });

    if (idx === 0) {
      buildTitleSlide(slide, pptx, content, topic);
    } else if (slideData.type === 'agenda' || idx === 1) {
      buildAgendaSlide(slide, pptx, slideData);
    } else if (idx === slides.length - 1) {
      buildFinalSlide(slide, pptx, slideData, content);
    } else {
      const hasImg = imageMap[slideData.slideNumber] && fs.existsSync(imageMap[slideData.slideNumber]);
      buildContentSlide(slide, pptx, slideData, idx, slides.length, hasImg ? imageMap[slideData.slideNumber] : null);
    }

    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
  });

  await pptx.writeFile({ fileName: outputPath });
  logger.info(`PPTX yaratildi: ${outputPath} (${slides.length} slayd)`);
  return outputPath;
}

// ── Slayd quruvchlari ──────────────────────────────────────────────────────

function buildTitleSlide(slide, pptx, content, topic) {
  // Background shapes
  slide.addShape(pptx.ShapeType.ellipse, { x: 8.5, y: -1.5, w: 6, h: 6, fill: { color: C.primary, transparency: 85 } });
  slide.addShape(pptx.ShapeType.ellipse, { x: -1.5, y: 4, w: 4, h: 4, fill: { color: C.cyan, transparency: 90 } });

  // Accent line
  slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: 3.1, w: 1.2, h: 0.07, fill: { color: C.primary } });

  // Title
  slide.addText(content.title || topic, {
    x: 0.8, y: 1.3, w: 11, h: 1.8,
    fontSize: 36, bold: true, color: C.text,
    fontFace: 'Calibri', align: 'left', valign: 'bottom'
  });

  // Subtitle
  slide.addText(topic, {
    x: 0.8, y: 3.3, w: 9, h: 0.5,
    fontSize: 16, color: C.cyan, fontFace: 'Calibri', align: 'left'
  });

  // Meta info
  slide.addText(`${new Date().getFullYear()} yil`, {
    x: 0.8, y: 4.1, w: 4, h: 0.35,
    fontSize: 12, color: C.textMuted, fontFace: 'Calibri'
  });

  // Bottom right design element
  slide.addText('AI ACADEMIC', {
    x: 9.5, y: 6.5, w: 3.5, h: 0.4,
    fontSize: 11, bold: true, color: C.primary,
    fontFace: 'Calibri', align: 'right', charSpacing: 4
  });
}

function buildAgendaSlide(slide, pptx, slideData) {
  addSlideHeader(slide, 'REJA', slideData.title);

  const items = Array.isArray(slideData.content) ? slideData.content : [];
  items.forEach((item, i) => {
    const y = 1.5 + i * 0.75;
    // Number badge
    slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: y + 0.1, w: 0.4, h: 0.4, fill: { color: C.primary }, rectRadius: 0.05 });
    slide.addText(`${i + 1}`, { x: 0.6, y: y + 0.1, w: 0.4, h: 0.4, fontSize: 13, bold: true, color: C.white, align: 'center', valign: 'middle' });
    // Item text
    slide.addText(item, { x: 1.2, y: y, w: 11, h: 0.6, fontSize: 14, color: C.textSub, fontFace: 'Calibri', valign: 'middle' });
    // Divider
    if (i < items.length - 1) {
      slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: y + 0.62, w: 11.5, h: 0.01, fill: { color: C.divider } });
    }
  });
}

function buildContentSlide(slide, pptx, slideData, idx, total, imagePath) {
  addSlideHeader(slide, `${idx}/${total - 1}`, slideData.title);

  const hasImage = !!imagePath;
  const contentW = hasImage ? 7.0 : 12.0;
  const items = Array.isArray(slideData.content) ? slideData.content : [];

  items.forEach((item, i) => {
    const y = 1.55 + i * 0.78;
    // Bullet dot
    slide.addShape(pptx.ShapeType.ellipse, { x: 0.55, y: y + 0.22, w: 0.12, h: 0.12, fill: { color: C.primary } });
    // Text
    slide.addText(item, {
      x: 0.85, y, w: contentW - 0.85, h: 0.72,
      fontSize: 13.5, color: C.textSub, fontFace: 'Calibri',
      valign: 'middle', wrap: true
    });
  });

  if (hasImage) {
    // Image frame
    slide.addShape(pptx.ShapeType.roundRect, { x: 7.6, y: 1.3, w: 4.8, h: 5.1, fill: { color: C.card }, line: { color: C.primary, width: 1, transparency: 60 }, rectRadius: 0.15 });
    slide.addImage({ path: imagePath, x: 7.7, y: 1.4, w: 4.6, h: 4.9 });
  } else if (idx % 3 === 0) {
    // Dekorativ element
    slide.addShape(pptx.ShapeType.ellipse, { x: 10.5, y: 3, w: 2.8, h: 2.8, fill: { color: C.primary, transparency: 88 } });
    slide.addText(slideData.title?.charAt(0) || '?', {
      x: 10.5, y: 3, w: 2.8, h: 2.8,
      fontSize: 64, bold: true, color: C.primary,
      align: 'center', valign: 'middle', transparency: 40
    });
  }
}

function buildFinalSlide(slide, pptx, slideData, content) {
  slide.addShape(pptx.ShapeType.ellipse, { x: 3.5, y: 0.8, w: 6.5, h: 6.5, fill: { color: C.primary, transparency: 92 } });

  slide.addText('XULOSA', {
    x: 0.5, y: 0.4, w: 12.3, h: 0.5,
    fontSize: 13, bold: true, color: C.primary,
    align: 'center', charSpacing: 6, fontFace: 'Calibri'
  });

  const mainText = Array.isArray(slideData.content)
    ? slideData.content.join('\n\n')
    : content.summary || '';

  slide.addText(mainText, {
    x: 1.2, y: 1.2, w: 11, h: 4.5,
    fontSize: 14, color: C.textSub, fontFace: 'Calibri',
    align: 'center', valign: 'middle', wrap: true, lineSpacingMultiple: 1.5
  });

  slide.addText('Savollaringiz bormi?', {
    x: 0.5, y: 6.0, w: 12.3, h: 0.5,
    fontSize: 18, bold: true, color: C.cyan,
    align: 'center', fontFace: 'Calibri'
  });
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function addSlideHeader(slide, counter, title) {
  // Top accent bar
  // Counter badge
  slide.addText(counter, {
    x: 12.0, y: 0.1, w: 1.3, h: 0.35,
    fontSize: 9, color: C.textMuted, align: 'right', fontFace: 'Calibri'
  });
  // Vertical accent
  slide.addShape(/* left bar */ 'rect', { x: 0.4, y: 0.22, w: 0.06, h: 0.85, fill: { color: C.primary } });
  // Title
  slide.addText(title || '', {
    x: 0.65, y: 0.2, w: 11.3, h: 0.9,
    fontSize: 22, bold: true, color: C.text, fontFace: 'Calibri', valign: 'middle'
  });
  // Divider
  slide.addShape('rect', { x: 0.4, y: 1.2, w: 12.5, h: 0.03, fill: { color: C.divider } });
}

module.exports = { createPptx };
