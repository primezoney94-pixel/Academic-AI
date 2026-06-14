/**
 * Oddiy in-memory statistika tracker
 * Production da Redis yoki DB ga almashtiring
 */
const stats = {
  totalGenerated: 0,
  byType: {},
  byLanguage: { uz: 0, ru: 0, en: 0 },
  errors: 0,
  startTime: Date.now()
};

function recordGeneration(workTypeId, language) {
  stats.totalGenerated++;
  stats.byType[workTypeId] = (stats.byType[workTypeId] || 0) + 1;
  if (language && stats.byLanguage[language] !== undefined) {
    stats.byLanguage[language]++;
  }
}

function recordError() {
  stats.errors++;
}

function getStats() {
  const uptimeMs = Date.now() - stats.startTime;
  const hours = Math.floor(uptimeMs / 3600000);
  const minutes = Math.floor((uptimeMs % 3600000) / 60000);
  return {
    ...stats,
    uptime: `${hours}h ${minutes}m`,
    uptimeMs
  };
}

module.exports = { recordGeneration, recordError, getStats };
