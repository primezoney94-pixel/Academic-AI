const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

const LANG_INSTRUCTIONS = {
  uz: 'O\'ZBEK TILIDA yoz. Rasmiy akademik uslubda. O\'zbek adabiy tilidan foydalan.',
  ru: 'Пиши ТОЛЬКО НА РУССКОМ ЯЗЫКЕ. Академический официальный стиль.',
  en: 'Write ONLY IN ENGLISH. Formal academic style.'
};

/**
 * Retry wrapper — API xatolarida qayta urinish
 */
async function withRetry(fn, maxAttempts = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.status === 529 || err.status === 503 || err.message?.includes('overloaded');
      if (attempt === maxAttempts || !isRetryable) throw err;
      logger.warn(`Claude API urinish ${attempt} muvaffaqiyatsiz. ${delayMs}ms kutilmoqda...`);
      await new Promise(r => setTimeout(r, delayMs * attempt));
    }
  }
}

/**
 * Asosiy kontent yaratish funksiyasi
 */
async function generateContent(workType, topic, language = 'uz') {
  const langInstruction = LANG_INSTRUCTIONS[language] || LANG_INSTRUCTIONS.uz;

  const systemPrompt = `Sen tajribali akademik yozuvchi va mutaxassissan.
${langInstruction}
MUHIM QOIDALAR:
1. Faqat to'g'ri JSON formatida javob ber — boshqa hech qanday matn yo'q
2. JSON oldidan yoki keyin hech narsa yozma
3. Markdown backtick (\`\`\`) ishlatma
4. Barcha bo'limlarni to'liq yoz, qisqartirma
5. Akademik, rasmiy uslubda yoz`;

  const userPrompt = buildPrompt(workType, topic);

  return await withRetry(async () => {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const rawText = response.content[0].text.trim();
    logger.debug(`Claude javob uzunligi: ${rawText.length} belgi`);

    // JSON parsing — turli formatlarni handle qilish
    let jsonText = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonText = jsonMatch[1];
    else {
      const objMatch = rawText.match(/(\{[\s\S]*\})/);
      if (objMatch) jsonText = objMatch[1];
    }

    try {
      return JSON.parse(jsonText);
    } catch (parseErr) {
      logger.error('JSON parse xatosi:', rawText.substring(0, 300));
      throw new Error('Claude javobi JSON formatida emas. Qayta urining.');
    }
  });
}

function buildPrompt(workType, topic) {
  if (workType.format === 'pptx') {
    return `Mavzu: "${topic}"
Taqdimot uchun ${workType.slides} ta slayd yarating.

FAQAT quyidagi JSON formatida javob bering:
{
  "title": "Taqdimot sarlavhasi",
  "slides": [
    {
      "slideNumber": 1,
      "title": "Sarlavha slayd",
      "content": ["${topic}", "Taqdimotchi: Talaba", "Yil: ${new Date().getFullYear()}"],
      "notes": "Taqdimotchi uchun izoh",
      "type": "title"
    },
    {
      "slideNumber": 2,
      "title": "Reja",
      "content": ["1. Kirish", "2. Asosiy tushunchalar", "3. Tahlil", "4. Natijalar", "5. Xulosa"],
      "notes": "Taqdimot rejasini tushuntiring",
      "type": "agenda"
    }
  ],
  "summary": "Umumiy xulosa matni"
}

TALABLAR:
- Kamida 13 ta slayd bo'lsin
- Har bir slaydda kamida 4-5 ta content point
- Oxirgi slayd — "Xulosa va Savollar" bo'lsin
- type qiymatlari: "title", "agenda", "content", "stats", "conclusion"`;
  }

  if (workType.id === 'test_savollari') {
    return `Mavzu: "${topic}"
25 ta test savoli yarating — turli qiyinlik darajasida (10 ta oson, 10 ta o'rta, 5 ta qiyin).

FAQAT quyidagi JSON formatida javob bering:
{
  "title": "Test: ${topic}",
  "subject": "Fan nomi",
  "totalQuestions": 25,
  "questions": [
    {
      "number": 1,
      "difficulty": "oson",
      "question": "Savol matni?",
      "options": { "A": "Variant A", "B": "Variant B", "C": "Variant C", "D": "Variant D" },
      "correct": "A",
      "explanation": "Nima uchun A to'g'ri - qisqa izoh"
    }
  ]
}`;
  }

  // Default: DOCX format
  return `Mavzu: "${topic}"
Tur: ${workType.label}
Hajm: ${workType.pages} bet
Bo'limlar: ${workType.sections.join(' → ')}
Qo'shimcha: ${workType.prompt_hint}

FAQAT quyidagi JSON formatida javob bering:
{
  "title": "Ishning to'liq sarlavhasi",
  "workType": "${workType.id}",
  "abstract": "Qisqa annotatsiya (100-150 so'z)",
  "sections": [
    {
      "title": "Bo'lim sarlavhasi",
      "content": "Bo'lim matni — kamida 400-600 so'z, paragraflar bilan",
      "subsections": [
        {
          "title": "Kichik bo'lim sarlavhasi",
          "content": "Kichik bo'lim matni — kamida 200-300 so'z"
        }
      ]
    }
  ],
  "conclusion": "Xulosa matni — 150-200 so'z",
  "references": [
    "1. Muallif I.I. Kitob nomi. — Toshkent: Nashriyot, 2022. — 250 b.",
    "2. Muallif A.A. Maqola nomi // Jurnal nomi. — 2023. — №2. — B. 45-52."
  ],
  "keywords": ["kalit so'z 1", "kalit so'z 2", "kalit so'z 3", "kalit so'z 4", "kalit so'z 5"]
}

MUHIM: Har bir section.content kamida 500 so'z bo'lsin. Jami hajm ${workType.pages} betga mos kelsin.`;
}

/**
 * Taqdimot slaydlari uchun rasm tavsifi yaratish
 */
async function generateImagePrompt(topic, slideTitle, bulletPoints) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `Generate a DALL-E image prompt (max 150 chars, English only) for a professional educational presentation slide.
Topic: "${topic}"
Slide: "${slideTitle}"
Content: ${bulletPoints.slice(0, 2).join(', ')}
Return ONLY the prompt text, nothing else. No quotes.`
    }]
  });

  return response.content[0].text.trim().replace(/^["']|["']$/g, '');
}

module.exports = { generateContent, generateImagePrompt };
