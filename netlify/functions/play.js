const db = require('./lib/db');

// POST /api/play  { email, nickname, score }  →  { ok, remaining }
// The daily limit is re-checked server-side here — this is the authoritative gate.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return db.json(405, { error: 'POST only' });
  try {
    const { email, nickname, score } = JSON.parse(event.body || '{}');
    if (!email || !nickname || typeof score !== 'number') {
      return db.json(400, { error: 'email, nickname, score required' });
    }

    const remaining = await db.attemptsRemaining(email);
    if (remaining <= 0) {
      return db.json(403, { ok: false, remaining: 0, error: 'daily limit reached' });
    }

    await db.recordPlay({ email, nickname, score });
    return db.json(200, { ok: true, remaining: await db.attemptsRemaining(email) });
  } catch (e) {
    return db.json(500, { error: e.message });
  }
};
