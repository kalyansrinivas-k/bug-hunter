const db = require('./lib/db');

// GET /api/attempts?email=...  →  { remaining }
exports.handler = async (event) => {
  try {
    const email = (event.queryStringParameters || {}).email;
    if (!email) return db.json(400, { error: 'email required' });
    return db.json(200, { remaining: await db.attemptsRemaining(email) });
  } catch (e) {
    return db.json(500, { error: e.message });
  }
};
