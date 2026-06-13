/* =====================================================
   Bug Hunter — Data Layer

   Production: calls the Netlify Functions at /api/* (backed by Supabase).
   Fallback:   a localStorage mock — used for local static dev, or whenever the
               API is unreachable. Same async API and same return shapes either
               way, so game.js never needs to know which is active.

   Canonical leaderboard row shape (both backends):
     { rank, nickname, cumulative, dayBests: {1,2,3}, isMe }

   Day bucketing uses the event timezone (Europe/Oslo) and a fixed Day-1 anchor.
   EVENT_CONFIG.startDate MUST match the Netlify EVENT_START_DATE env var.
   ===================================================== */

const EVENT_CONFIG = {
  timezone:   'Europe/Oslo',
  startDate:  '2026-06-16', // must match Netlify env EVENT_START_DATE
  dailyLimit: 3,
  totalDays:  3,
};

const STORAGE_KEY = 'bughunter_plays_v1';

// ── Time helpers (client-side; used for the day-3 reveal + the mock) ──
function osloDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_CONFIG.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function eventDayNumber(date = new Date()) {
  const start = Date.parse(`${EVENT_CONFIG.startDate}T00:00:00Z`);
  const today = Date.parse(`${osloDateString(date)}T00:00:00Z`);
  return Math.floor((today - start) / 86_400_000) + 1;
}

function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// ── Remote backend (Netlify Functions) ──────────────────
async function apiJson(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`api ${res.status}`);
  return res.json();
}

async function remoteAttemptsRemaining(email) {
  const d = await apiJson(`/api/attempts?email=${encodeURIComponent(email)}`);
  return d.remaining;
}

async function remoteRecordPlay({ email, nickname, score }) {
  return apiJson('/api/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, nickname, score }),
  });
}

async function remoteGetLeaderboard(meEmail) {
  const rows = await apiJson(`/api/leaderboard?email=${encodeURIComponent(meEmail || '')}`);
  return rows.map(r => ({
    rank:       r.rank,
    nickname:   r.nickname,
    cumulative: r.cumulative,
    dayBests:   { 1: r.day1_best, 2: r.day2_best, 3: r.day3_best },
    isMe:       !!r.isMe,
  }));
}

// ── localStorage mock backend ────────────────────────────
function loadPlays() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function savePlays(plays) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plays));
}

async function mockPlaysToday(email) {
  const key = normaliseEmail(email);
  const day = eventDayNumber();
  return loadPlays().filter(p => p.email === key && p.day === day).length;
}

async function mockAttemptsRemaining(email) {
  return Math.max(0, EVENT_CONFIG.dailyLimit - (await mockPlaysToday(email)));
}

async function mockRecordPlay({ email, nickname, score }) {
  const record = {
    email:     normaliseEmail(email),
    nickname:  String(nickname).trim(),
    score:     Math.round(score),
    timestamp: new Date().toISOString(),
    day:       eventDayNumber(),
  };
  const plays = loadPlays();
  plays.push(record);
  savePlays(plays);
  return record;
}

async function mockGetLeaderboard(meEmail) {
  const me    = normaliseEmail(meEmail);
  const plays = loadPlays();
  const byEmail = new Map();

  for (const p of plays) {
    // Count every play, so the board is live during pre-event testing/demos.
    // The "reset" on the event start day is a manual DB clear (see BACKEND.md).
    if (!byEmail.has(p.email)) {
      byEmail.set(p.email, { email: p.email, nickname: p.nickname, dayBests: {} });
    }
    const entry = byEmail.get(p.email);
    entry.nickname = p.nickname; // most recent nickname
    const prevBest = entry.dayBests[p.day] ?? -1;
    if (p.score > prevBest) entry.dayBests[p.day] = p.score;
  }

  const rows = [...byEmail.values()].map(entry => {
    // Cumulative = sum of best-per-day across every day played.
    const cumulative = Object.values(entry.dayBests).reduce((a, b) => a + b, 0);
    return {
      nickname:   entry.nickname,
      cumulative,
      dayBests:   entry.dayBests,
      isMe:       me !== '' && entry.email === me,
    };
  });

  rows.sort((a, b) => b.cumulative - a.cumulative);
  rows.forEach((row, i) => { row.rank = i + 1; });
  return rows;
}

// ── Public API: try the remote backend, fall back to the mock ──
// Writes/limits are authoritative on the server; the mock keeps local dev working.
async function attemptsRemaining(email) {
  try { return await remoteAttemptsRemaining(email); }
  catch { return mockAttemptsRemaining(email); }
}

async function canPlay(email) {
  return (await attemptsRemaining(email)) > 0;
}

async function recordPlay(play) {
  try { return await remoteRecordPlay(play); }
  catch { return mockRecordPlay(play); }
}

async function getLeaderboard(meEmail) {
  try { return await remoteGetLeaderboard(meEmail); }
  catch { return mockGetLeaderboard(meEmail); }
}

window.BugHunterData = {
  EVENT_CONFIG,
  eventDayNumber,
  attemptsRemaining,
  canPlay,
  recordPlay,
  getLeaderboard,
};
