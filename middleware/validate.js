/**
 * Generate so'rovi uchun validatsiya middleware
 */
function validateGenerateRequest(req, res, next) {
  const { workTypeId, topic, language } = req.body;

  if (!workTypeId || typeof workTypeId !== 'string') {
    return res.status(400).json({ error: 'workTypeId majburiy maydon.' });
  }

  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'topic majburiy maydon.' });
  }

  const trimmedTopic = topic.trim();
  if (trimmedTopic.length < 3) {
    return res.status(400).json({ error: 'Mavzu kamida 3 ta belgi bo\'lishi kerak.' });
  }
  if (trimmedTopic.length > 200) {
    return res.status(400).json({ error: 'Mavzu 200 ta belgidan oshmasin.' });
  }

  const allowedLangs = ['uz', 'ru', 'en'];
  if (language && !allowedLangs.includes(language)) {
    return res.status(400).json({ error: `Til faqat: ${allowedLangs.join(', ')}` });
  }

  // Sanitize
  req.body.topic = trimmedTopic;
  next();
}

module.exports = { validateGenerateRequest };
