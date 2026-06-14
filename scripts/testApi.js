/**
 * Backend ishlashini tez tekshirish uchun script
 * Ishlatish: node scripts/testApi.js
 */
require('dotenv').config();

const BASE = `http://localhost:${process.env.PORT || 3001}`;

async function test(name, fn) {
  process.stdout.write(`Testing: ${name}... `);
  try {
    const result = await fn();
    console.log('✅', typeof result === 'string' ? result : 'OK');
  } catch (err) {
    console.log('❌', err.message);
  }
}

async function main() {
  console.log(`\n🔍 API Test: ${BASE}\n`);

  await test('Health check', async () => {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    if (!data.status === 'ok') throw new Error('Status not ok');
    return `status: ${data.status}`;
  });

  await test('Work types', async () => {
    const res = await fetch(`${BASE}/api/work/types`);
    const data = await res.json();
    if (!data.types?.length) throw new Error('Types bo\'sh');
    return `${data.types.length} ta tur topildi`;
  });

  await test('Stats endpoint', async () => {
    const res = await fetch(`${BASE}/api/stats`);
    const data = await res.json();
    if (!data.stats) throw new Error('Stats yo\'q');
    return `uptime: ${data.stats.uptime}`;
  });

  await test('Generate validation (bo\'sh mavzu)', async () => {
    const res = await fetch(`${BASE}/api/work/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workTypeId: 'referat', topic: '' })
    });
    if (res.status !== 400) throw new Error(`400 kutilgan, ${res.status} keldi`);
    return '400 to\'g\'ri qaytdi';
  });

  console.log('\n✅ Asosiy testlar tugadi.\n');
  console.log('📝 Haqiqiy ish yaratishni test qilish uchun api-tests.http faylidan foydalaning.');
}

main().catch(console.error);
