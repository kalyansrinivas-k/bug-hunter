/* Shared Supabase access for the Netlify Functions.
   Talks to Supabase's PostgREST API with the service_role key (server-side only,
   bypasses RLS). No npm deps — uses the global fetch in Node 18+. */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TIMEZONE     = process.env.EVENT_TIMEZONE || 'Europe/Oslo';
const START_DATE   = process.env.EVENT_START_DATE || '2026-06-16';
const DAILY_LIMIT  = 3;
const TOTAL_DAYS   = 3;

function assertConfigured() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('Supabase env vars missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }
}

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// ── Event-day computation (server-side, matches data.js) ──
function osloDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function eventDayNumber(date = new Date()) {
  const start = Date.parse(`${START_DATE}T00:00:00Z`);
  const today = Date.parse(`${osloDateString(date)}T00:00:00Z`);
  return Math.floor((today - start) / 86_400_000) + 1;
}

function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// ── Queries ──
async function playsToday(email) {
  assertConfigured();
  const day = eventDayNumber();
  const url = `${SUPABASE_URL}/rest/v1/plays?select=id`
            + `&email=eq.${encodeURIComponent(normEmail(email))}&day=eq.${day}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`supabase select ${res.status}: ${await res.text()}`);
  return (await res.json()).length;
}

async function attemptsRemaining(email) {
  return Math.max(0, DAILY_LIMIT - (await playsToday(email)));
}

async function recordPlay({ email, nickname, score }) {
  assertConfigured();
  const row = {
    email:    normEmail(email),
    nickname: String(nickname).trim().slice(0, 40),
    score:    Math.max(0, Math.min(100, Math.round(score))),
    day:      eventDayNumber(),
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/plays`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`supabase insert ${res.status}: ${await res.text()}`);
  return row;
}

// Returns email-free rows; isMe is computed here so the client never sees emails.
async function getLeaderboard(meEmail) {
  assertConfigured();
  const url = `${SUPABASE_URL}/rest/v1/leaderboard`
            + `?select=email,nickname,day1_best,day2_best,day3_best,cumulative,rank`
            + `&order=cumulative.desc`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`supabase leaderboard ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  const me = normEmail(meEmail);
  return rows.map(r => ({
    rank:       Number(r.rank),
    nickname:   r.nickname,
    day1_best:  r.day1_best,
    day2_best:  r.day2_best,
    day3_best:  r.day3_best,
    cumulative: r.cumulative,
    isMe:       me !== '' && normEmail(r.email) === me,
  }));
}

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

module.exports = {
  DAILY_LIMIT, TOTAL_DAYS, eventDayNumber,
  playsToday, attemptsRemaining, recordPlay, getLeaderboard, json,
};
