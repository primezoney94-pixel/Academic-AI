const {
  Document, Paragraph, TextRun, HeadingLevel,
  AlignmentType, PageBreak, Packer,
  Header, Footer, PageNumber,
  convertInchesToTwip, UnderlineType,
  TableOfContents, StyleLevel
} = require('docx');
const fs = require('fs');
const logger = require('../utils/logger');

const FONT = 'Times New Roman';
const FONT_SIZE_BODY = 24;     // 12pt (twip: pt * 2)
const FONT_SIZE_SMALL = 20;    // 10pt
const LINE_SPACING = 360;      // 1.5 interval
const INDENT_FIRST = convertInchesToTwip(0.5); // 1.25cm
const MARGIN = convertInchesToTwip(1);
const MARGIN_LEFT = convertInchesToTwip(1.5);  // Chap — 3cm (muqova uchun)

async function createDocx(content, workType, outputPath) {
  const children = [];

  // ── Sarlavha sahifasi ──────────────────────────────────────────────────────
  buildTitlePage(children, content, workType);

  // ── Annotatsiya ────────────────────────────────────────────────────────────
  if (content.abstract) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(heading1('ANNOTATSIYA'));
    children.push(bodyParagraph(content.abstract));
  }

  // ── Mundarija (placeholder) ────────────────────────────────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1('MUNDARIJA'));
  if (content.sections) {
    content.sections.forEach((sec, i) => {
      children.push(tocEntry(`${i + 1}. ${sec.title}`, false));
      if (sec.subsections) {
        sec.subsections.forEach((sub, j) => {
          children.push(tocEntry(`    ${i + 1}.${j + 1}. ${sub.title}`, true));
        });
      }
    });
  }
  children.push(tocEntry('XULOSA', false));
  children.push(tocEntry('ADABIYOTLAR RO\'YXATI', false));

  // ── Kirish ─────────────────────────────────────────────────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ── Bo'limlar ──────────────────────────────────────────────────────────────
  if (content.sections) {
    content.sections.forEach((section, sIdx) => {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(heading1(`${sIdx + 1}. ${section.title.toUpperCase()}`));

      if (section.content) {
        splitToParagraphs(section.content).forEach(p => children.push(bodyParagraph(p)));
      }

      if (section.subsections) {
        section.subsections.forEach((sub, subIdx) => {
          children.push(heading2(`${sIdx + 1}.${subIdx + 1}. ${sub.title}`));
          if (sub.content) {
            splitToParagraphs(sub.content).forEach(p => children.push(bodyParagraph(p)));
          }
        });
      }
    });
  }

  // ── Test savollari ─────────────────────────────────────────────────────────
  if (content.questions) {
    buildTestQuestions(children, content);
  }

  // ── Xulosa ─────────────────────────────────────────────────────────────────
  if (content.conclusion) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(heading1('XULOSA'));
    splitToParagraphs(content.conclusion).forEach(p => children.push(bodyParagraph(p)));
  }

  // ── Adabiyotlar ────────────────────────────────────────────────────────────
  if (content.references?.length) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(heading1('ADABIYOTLAR RO\'YXATI'));
    content.references.forEach(ref => {
      children.push(new Paragraph({
        children: [new TextRun({ text: ref, size: FONT_SIZE_BODY, font: FONT })],
        spacing: { before: 80, after: 80, line: LINE_SPACING },
        indent: { left: convertInchesToTwip(0.3), hanging: convertInchesToTwip(0.3) }
      }));
    });
  }

  // ── Kalit so'zlar ──────────────────────────────────────────────────────────
  if (content.keywords?.length) {
    children.push(emptyParagraph());
    children.push(new Paragraph({
      children: [
        new TextRun({ text: 'Kalit so\'zlar: ', bold: true, size: FONT_SIZE_BODY, font: FONT }),
        new TextRun({ text: content.keywords.join(', '), italics: true, size: FONT_SIZE_BODY, font: FONT })
      ],
      spacing: { before: 200 }
    }));
  }

  // ── Document yaratish ──────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: FONT_SIZE_BODY },
          paragraph: { spacing: { line: LINE_SPACING } }
        }
      },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1',
          run: { bold: true, size: 28, font: FONT, color: '000000' },
          paragraph: { spacing: { before: 480, after: 240 }, alignment: AlignmentType.CENTER }
        },
        {
          id: 'Heading2', name: 'Heading 2',
          run: { bold: true, size: 26, font: FONT, color: '000000' },
          paragraph: { spacing: { before: 360, after: 180 } }
        }
      ]
    },
    sections: [{
      properties: {
        page: {
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN_LEFT }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [new TextRun({ text: content.title || '', size: 18, color: '777777', font: FONT })],
            alignment: AlignmentType.RIGHT,
            border: { bottom: { color: 'DDDDDD', size: 1, space: 4, style: 'single' } }
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun({ text: '— ', size: 18, color: '999999' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '555555' }),
              new TextRun({ text: ' —', size: 18, color: '999999' })
            ],
            alignment: AlignmentType.CENTER
          })]
        })
      },
      children
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  logger.info(`DOCX yaratildi: ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  return outputPath;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTitlePage(children, content, workType) {
  const spaces = (n) => Array(n).fill(new Paragraph({ text: '', spacing: { before: 0, after: 0 } }));

  children.push(...spaces(3));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'O\'ZBEKISTON RESPUBLIKASI OLIY VA O\'RTA MAXSUS TA\'LIM VAZIRLIGI', size: 20, font: FONT })],
    alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 }
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: '[UNIVERSITET NOMI]', bold: true, size: 22, font: FONT })],
    alignment: AlignmentType.CENTER, spacing: { after: 200 }
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: '[FAKULTET VA KAFEDRA NOMI]', size: 20, font: FONT })],
    alignment: AlignmentType.CENTER, spacing: { after: 600 }
  }));

  children.push(new Paragraph({
    children: [new TextRun({ text: workType.label.replace(/^\S+\s*/, '').toUpperCase(), bold: true, size: 22, font: FONT })],
    alignment: AlignmentType.CENTER, spacing: { after: 200 }
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'MAVZU:', bold: true, size: 24, font: FONT })],
    alignment: AlignmentType.CENTER, spacing: { after: 100 }
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `"${content.title || ''}"`, bold: true, size: 26, font: FONT })],
    alignment: AlignmentType.CENTER, spacing: { after: 600 }
  }));

  children.push(...spaces(2));
  children.push(new Paragraph({
    children: [new TextRun({ text: `Bajardi:  _____________________  [Talaba F.I.Sh.]`, size: FONT_SIZE_BODY, font: FONT })],
    alignment: AlignmentType.RIGHT, spacing: { after: 150 }, indent: { right: convertInchesToTwip(0.5) }
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `Tekshirdi: _____________________  [Ustoz F.I.Sh.]`, size: FONT_SIZE_BODY, font: FONT })],
    alignment: AlignmentType.RIGHT, spacing: { after: 600 }, indent: { right: convertInchesToTwip(0.5) }
  }));

  children.push(new Paragraph({
    children: [new TextRun({ text: `Toshkent — ${new Date().getFullYear()}`, size: FONT_SIZE_BODY, font: FONT })],
    alignment: AlignmentType.CENTER
  }));
  children.push(new Paragraph({ children: [new PageBreak()] }));
}

function buildTestQuestions(children, content) {
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1(`TEST SAVOLLARI: ${content.title || ''}`));

  content.questions.forEach(q => {
    const difficulty = q.difficulty ? ` [${q.difficulty}]` : '';
    children.push(new Paragraph({
      children: [new TextRun({ text: `${q.number}. ${q.question}${difficulty}`, bold: true, size: FONT_SIZE_BODY, font: FONT })],
      spacing: { before: 240, after: 100 }
    }));

    Object.entries(q.options || {}).forEach(([key, val]) => {
      const isCorrect = q.correct === key;
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `   ${key}) `, bold: isCorrect, size: FONT_SIZE_BODY, font: FONT }),
          new TextRun({ text: val, bold: isCorrect, underline: isCorrect ? { type: UnderlineType.SINGLE } : undefined, size: FONT_SIZE_BODY, font: FONT })
        ],
        spacing: { before: 60, after: 60 },
        indent: { left: convertInchesToTwip(0.3) }
      }));
    });

    if (q.explanation) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `Izoh: ${q.explanation}`, italics: true, size: FONT_SIZE_SMALL, color: '555555', font: FONT })],
        spacing: { before: 60, after: 200 }, indent: { left: convertInchesToTwip(0.3) }
      }));
    }
  });
}

function heading1(text) {
  return new Paragraph({
    text, heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 240 }
  });
}

function heading2(text) {
  return new Paragraph({
    text, heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 180 }
  });
}

function bodyParagraph(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: FONT_SIZE_BODY, font: FONT })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 120, after: 120, line: LINE_SPACING },
    indent: { firstLine: INDENT_FIRST }
  });
}

function tocEntry(text, isSubItem) {
  return new Paragraph({
    children: [new TextRun({ text, size: isSubItem ? 20 : 22, font: FONT })],
    spacing: { before: isSubItem ? 60 : 120, after: isSubItem ? 60 : 80 },
    indent: { left: isSubItem ? convertInchesToTwip(0.5) : 0 }
  });
}

function emptyParagraph() {
  return new Paragraph({ text: '', spacing: { before: 0, after: 0 } });
}

function splitToParagraphs(text) {
  return text
    .split(/\n{2,}|\n(?=[A-ZА-ЯA-Z\u0400-\u04FF])/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(p => p.length > 0);
}

module.exports = { createDocx };
