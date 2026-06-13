/* =====================================================
   Bug Hunter — Data Layer (mock, localStorage-backed)

   This module is the ONLY place the game talks to "the backend".
   Every function is async and returns the same shape the real
   Supabase + Netlify Functions backend will return at Feature 8,
   so swapping the implementation is a drop-in — no call-site changes.

   Day bucketing uses the event venue timezone (Europe/Oslo) and a
   fixed Day-1 anchor date, per PRD §3 and the Decisions Log.
   ===================================================== */

const EVENT_CONFIG = {
  timezone:   'Europe/Oslo',
  startDate:  '2026-06-13', // Day 1 anchor — event venue local calendar date
  dailyLimit: 3,            // max plays per email per day
  totalDays:  3,
};

const STORAGE_KEY = 'bughunter_plays_v1';

// ── Time helpers ───────────────────────────────────────
// Calendar date (YYYY-MM-DD) in the event timezone for a given instant.
function osloDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_CONFIG.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

// Event day number (1-based) for a given instant. Day 1 = startDate.
// Days before the event are < 1; days after totalDays are > totalDays.
function eventDayNumber(date = new Date()) {
  const start = Date.parse(`${EVENT_CONFIG.startDate}T00:00:00Z`);
  const today = Date.parse(`${osloDateString(date)}T00:00:00Z`);
  return Math.floor((today - start) / 86_400_000) + 1;
}

// ── Storage helpers ────────────────────────────────────
// A "play" record: { email, nickname, score, timestamp, day }
function loadPlays() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function savePlays(plays) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plays));
}

function normaliseEmail(email) {
  return String(email).trim().toLowerCase();
}

// ── Public API (async to mirror the future network backend) ──

// How many times this email has played on the current event day.
async function playsToday(email) {
  const key = normaliseEmail(email);
  const day = eventDayNumber();
  return loadPlays().filter(p => p.email === key && p.day === day).length;
}

// Attempts left today for this email (0..dailyLimit).
async function attemptsRemaining(email) {
  const used = await playsToday(email);
  return Math.max(0, EVENT_CONFIG.dailyLimit - used);
}

// Whether this email may start another game today.
async function canPlay(email) {
  return (await attemptsRemaining(email)) > 0;
}

// Persist a completed game. Returns the stored record.
async function recordPlay({ email, nickname, score }) {
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

// Ranked standings: each player's best score per day + cumulative.
// Returns: [{ rank, email, nickname, dayBests: {1,2,3}, cumulative }]
// Sorted by cumulative desc. Cumulative = sum of daily bests (PRD §5, F6).
async function getLeaderboard() {
  const plays = loadPlays();
  const byEmail = new Map();

  for (const p of plays) {
    if (!byEmail.has(p.email)) {
      byEmail.set(p.email, { email: p.email, nickname: p.nickname, dayBests: {} });
    }
    const entry = byEmail.get(p.email);
    // Keep the most recent nickname this player used.
    entry.nickname = p.nickname;
    const prevBest = entry.dayBests[p.day] ?? -1;
    if (p.score > prevBest) entry.dayBests[p.day] = p.score;
  }

  const rows = [...byEmail.values()].map(entry => {
    let cumulative = 0;
    for (let d = 1; d <= EVENT_CONFIG.totalDays; d++) {
      cumulative += entry.dayBests[d] ?? 0;
    }
    return { ...entry, cumulative };
  });

  rows.sort((a, b) => b.cumulative - a.cumulative);
  rows.forEach((row, i) => { row.rank = i + 1; });
  return rows;
}

// Expose on window so game.js (loaded after this) can call it.
window.BugHunterData = {
  EVENT_CONFIG,
  eventDayNumber,
  playsToday,
  attemptsRemaining,
  canPlay,
  recordPlay,
  getLeaderboard,
};
