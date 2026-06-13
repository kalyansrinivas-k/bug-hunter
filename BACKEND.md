# Bug Hunter — Backend (Supabase) Plan

The game talks to the backend **only** through `data.js` (one swappable async data
layer). Today `data.js` is backed by `localStorage`; at **Feature 8** we swap the
implementation to call Netlify Functions backed by Supabase — **no game code changes**,
because the function signatures stay identical:

```
canPlay(email)            → boolean
attemptsRemaining(email)  → number (0..dailyLimit)
recordPlay({email,nickname,score}) → stored record
getLeaderboard()          → ranked rows
```

---

## 1. Database schema (Supabase / Postgres)

```sql
-- One row per completed game.
create table plays (
  id          bigint generated always as identity primary key,
  email       text        not null,
  nickname    text        not null,
  score       int         not null check (score between 0 and 100),
  day         int         not null check (day between 1 and 3),  -- event day number
  created_at  timestamptz not null default now()
);

create index plays_email_day_idx on plays (email, day);
```

### Leaderboard view — daily best → 3-day cumulative
The whole ranking is one SQL view (this is why Postgres/Supabase fits so well):

```sql
create or replace view leaderboard as
with daily_best as (              -- best score per player per day
  select email, day, max(score) as best
  from plays
  where day between 1 and 3       -- ignore pre-event test plays (day <= 0)
  group by email, day
),
latest_nick as (                  -- most recent nickname each player used
  select distinct on (email) email, nickname
  from plays
  where day between 1 and 3
  order by email, created_at desc
)
select
  d.email,                                                        -- server-only, never returned publicly
  n.nickname,
  coalesce(sum(d.best) filter (where d.day = 1), 0) as day1_best,
  coalesce(sum(d.best) filter (where d.day = 2), 0) as day2_best,
  coalesce(sum(d.best) filter (where d.day = 3), 0) as day3_best,
  sum(d.best)                                        as cumulative,
  rank() over (order by sum(d.best) desc)            as rank
from daily_best d
join latest_nick n using (email)
group by d.email, n.nickname
order by cumulative desc;
```

### Play-count check (the 3/day gate)
```sql
select count(*) from plays where email = $1 and day = $2;
```

---

## 2. Security / anti-cheat model

- **All writes go through a Netlify Function using the `service_role` key** (server-side
  only). The browser never holds that key and never writes directly — this is what makes
  the 3-plays-per-day limit tamper-resistant (the PRD's "not localStorage" requirement).
- The function **re-checks the play count server-side** before inserting; the client gate
  is just UX.
- **Email is never returned to the client.** The public leaderboard endpoint selects only
  `nickname, day1_best, day2_best, day3_best, cumulative, rank` — never `email`.
- Enable RLS on `plays` and grant no direct anon access; reads also go through functions
  (or expose a `security definer` RPC that returns the email-free columns). Simplest:
  route **both reads and writes through Netlify Functions** so the browser holds no
  Supabase keys at all.

---

## 3. Netlify Functions (API surface)

Each maps 1:1 to a `data.js` method:

| Function | Method | Maps to | Returns |
|---|---|---|---|
| `attempts` | `GET /api/attempts?email=` | `attemptsRemaining` | `{ remaining }` |
| `play`     | `POST /api/play` `{email,nickname,score}` | `recordPlay` (+ server-side gate) | `{ ok, remaining }` |
| `leaderboard` | `GET /api/leaderboard?email=` | `getLeaderboard` | `[{ rank, nickname, day1_best, day2_best, day3_best, cumulative, isMe }]` |

**Day number** is computed server-side in the function (Europe/Oslo + event start anchor)
so it can't be spoofed and matches the mock's logic exactly.

**"You" row highlight:** the UI highlights the current player's row. The mock matches by
`email` (it has it locally). The public API must NOT return other players' emails — instead
have the `leaderboard` function accept the caller's `email` and return a per-row boolean
`isMe` (server-side comparison), so the client can highlight without ever seeing emails.
Update `getLeaderboard()` to surface `isMe` and have the UI key off that instead of `email`.

---

## 4. Environment variables (Netlify)

| Var | Purpose | Secret? |
|---|---|---|
| `SUPABASE_URL` | project URL | no |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side writes/reads (bypasses RLS) | **yes** |
| `EVENT_START_DATE` | Day-1 anchor — `2026-06-16` (event runs Jun 16–18) | no |
| `EVENT_TIMEZONE` | `Europe/Oslo` | no |

Never commit these. The anon key isn't needed client-side if all access is via functions.

---

## 5. The Feature 8 swap (mechanical)

`data.js` keeps the same exported functions; the bodies change from `localStorage` to
`fetch('/api/...')`. Suggested approach: keep a small flag/auto-detect so local dev can
still run against the in-memory/localStorage mock when no backend is present, and use the
Supabase-backed path in production. Game code (`game.js`) is untouched.

Config that already matches the schema lives in `data.js` `EVENT_CONFIG`
(`timezone: Europe/Oslo`, `startDate`, `dailyLimit: 3`, `totalDays: 3`).
