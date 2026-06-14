const WORK_TYPES = [
  {
    id: 'kurs_ishi',
    label: '📚 Kurs ishi',
    description: '20-40 bet',
    format: 'docx',
    pages: '20-40',
    sections: ['Kirish', 'I Bob — Nazariy asoslar', 'II Bob — Tahlil', 'III Bob — Takliflar', 'Xulosa', 'Adabiyotlar'],
    prompt_hint: 'Kurs ishi — akademik uslub, bob va kichik bo\'limlarga ajratilgan, manbalar va iqtiboslar bilan'
  },
  {
    id: 'diplom_ishi',
    label: '🎓 Diplom ishi',
    description: '60-80 bet',
    format: 'docx',
    pages: '60-80',
    sections: ['Kirish', 'I Bob', 'II Bob', 'III Bob', 'Xulosa', 'Adabiyotlar ro\'yxati', 'Ilovalar'],
    prompt_hint: 'Bitiruv malakaviy ish — ilmiy uslub, to\'liq tadqiqot, gipoteza va natijalar bilan'
  },
  {
    id: 'referat',
    label: '📝 Referat',
    description: '10-15 bet',
    format: 'docx',
    pages: '10-15',
    sections: ['Kirish', 'Asosiy qism', 'Xulosa', 'Adabiyotlar'],
    prompt_hint: 'Referat — ixcham, aniq, asosiy fikrlarni qamrab oluvchi'
  },
  {
    id: 'taqdimot',
    label: '🖥️ Taqdimot',
    description: '12-15 slayd',
    format: 'pptx',
    slides: '12-15',
    sections: ['Sarlavha', 'Reja', 'Kirish', 'Asosiy qism (4-6 slayd)', 'Statistika', 'Xulosa', 'Rahmat'],
    prompt_hint: 'PowerPoint taqdimot — har slayd uchun sarlavha, 4-6 bullet point, taqdimotchi uchun izohlar'
  },
  {
    id: 'esse',
    label: '✍️ Esse',
    description: '5-7 bet',
    format: 'docx',
    pages: '5-7',
    sections: ['Kirish', 'Asosiy fikr', 'Dalillar va tahlil', 'Qarshi fikrlar', 'Xulosa'],
    prompt_hint: 'Esse — erkin fikr bayoni, shaxsiy pozitsiya, tanqidiy tahlil bilan'
  },
  {
    id: 'laboratoriya',
    label: '🔬 Laboratoriya ishi',
    description: '8-12 bet',
    format: 'docx',
    pages: '8-12',
    sections: ['Ish maqsadi', 'Nazariy qism', 'Uskunalar va materiallar', 'Amaliy qism', 'Natijalar va jadvallar', 'Xulosa'],
    prompt_hint: 'Lab hisobot — aniq, strukturalangan, jadvallar va natijalar bilan'
  },
  {
    id: 'mustaqil_ish',
    label: '📖 Mustaqil ish',
    description: '10-20 bet',
    format: 'docx',
    pages: '10-20',
    sections: ['Kirish', 'Asosiy qism', 'Tahlil', 'Xulosa'],
    prompt_hint: 'Mustaqil ish — mustaqil o\'rganish natijalari, tahlil va xulosalar'
  },
  {
    id: 'test_savollari',
    label: '❓ Test savollari',
    description: '25 savol',
    format: 'docx',
    count: '25 savol',
    sections: ['Savol', 'A variant', 'B variant', 'C variant', 'D variant', 'To\'g\'ri javob', 'Izoh'],
    prompt_hint: 'Test — 4 variantli, to\'g\'ri javob + qisqa izoh bilan, turli qiyinlik darajasida'
  },
  {
    id: 'hisobot',
    label: '📊 Hisobot',
    description: '15-25 bet',
    format: 'docx',
    pages: '15-25',
    sections: ['Kirish', 'Tadqiqot metodologiyasi', 'Natijalar tahlili', 'Muammolar va yechimlar', 'Tavsiyalar', 'Xulosa'],
    prompt_hint: 'Rasmiy hisobot — tahlil, raqamlar, jadvallar va amaliy tavsiyalar bilan'
  },
  {
    id: 'annotatsiya',
    label: '📋 Annotatsiya',
    description: '1-2 bet',
    format: 'docx',
    pages: '1-2',
    sections: ['Maqsad va vazifalar', 'Metodlar', 'Asosiy natijalar', 'Ahamiyati', 'Kalit so\'zlar'],
    prompt_hint: 'Ilmiy annotatsiya / abstract — qisqa, aniq, 250-300 so\'z atrofida'
  }
];

module.exports = { WORK_TYPES };
