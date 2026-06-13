const db = require('./lib/db');

// GET /api/leaderboard?email=...  →  [{ rank, nickname, day1_best, day2_best, day3_best, cumulative, isMe }]
// email is optional (used only to flag the caller's own row); it is never returned.
exports.handler = async (event) => {
  try {
    const email = (event.queryStringParameters || {}).email || '';
    return db.json(200, await db.getLeaderboard(email));
  } catch (e) {
    return db.json(500, { error: e.message });
  }
};
