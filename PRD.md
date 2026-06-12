# Bug Hunter — Product Requirements Document

## 1. Vision

Bug Hunter is a browser-based arcade game targeted at QA professionals. Inspired by Pac-Man and Bomberman, the player navigates a maze as a "tester," covering paths (test coverage) while catching or evading bugs (defects). The game is designed to be played live at a 3-day team event streamed on a large television, with a persistent leaderboard tracking all participants across all three days.

---

## 2. Target Audience

- QA engineers and testers
- Played at a 3-day team event / offsite / internal showcase
- Displayed on a large television in a streamed or event setting

---

## 3. Event Structure

- **Duration**: 3 days
- **Daily limit**: Each player (identified by email) may play up to 3 times per calendar day
- **Daily best**: Of the 3 plays in a day, only the highest score counts as that player's day score
- **Overall winner**: Sum of Day 1 best + Day 2 best + Day 3 best = final cumulative score
- **Winners announced**: End of Day 3, top 3 players by cumulative score
- **Day reset**: Midnight in the event venue's local timezone (configured at deployment)

---

## 4. Design System

The game uses the **Testsigma Marketing Design System** — a dark-mode-first palette of deep purple, teal, and pink.

- **Token file (CSS variables):** [`testsigma-tokens.css`](testsigma-tokens.css) — import as the first stylesheet; never hardcode colors, spacing, fonts, or radii
- **Design reference:** [`design-tokens.md`](design-tokens.md) — game element → token mappings, typography rules, spacing defaults

All features must reference these documents when making visual decisions.

---

## 5. Features

---

### Feature 1 — Core Game Engine

The foundational game: maze, player movement, dot collection, lives, and timer.

**Scope:**
- Fixed maze rendered in the browser, medium size, ~100 collectible dots lining all corridors
- Player-controlled tester character: moves up/down/left/right through corridors
- Dots disappear when the player passes over them; collected dots are retained across lives
- 3 lives per game session
- 60-second countdown timer
- Game ends when timer hits 0 OR player loses all 3 lives
- On death: time pauses ~1 second, player respawns at start position, timer resumes
- HUD always visible: countdown timer, lives remaining, current score, bombs remaining

**Out of scope for this feature:** bugs, bombs, scoring formula, leaderboard, registration

---

### Feature 2 — Bug AI

Bugs that patrol and chase, with escalating pressure as the clock runs down.

**Scope:**
- Bugs navigate maze corridors
- Two movement modes: **patrol** (random corridor traversal) and **chase** (pathfind toward player)
- Escalation schedule:

| Time Window | Bug Count | Behavior |
|---|---|---|
| 0–20s | 3 bugs | Mostly patrolling, slow speed |
| 20–40s | 4 bugs (1 spawns) | 2 bugs switch to chase mode |
| 40–60s | 5–6 bugs (1–2 more spawn) | All chasers faster, aggression peaks |

- Minimum 2 bugs in chase mode once the 20s mark is passed
- Maximum 6 bugs at any time
- **Touching an uncaught bug kills the player** (lose 1 life)

**Out of scope for this feature:** bomb interactions with bugs

---

### Feature 3 — Bomb Mechanics

Strategic bomb placement to catch bugs, with real risk of self-destruction.

**Scope:**
- Player starts each game with a budget of **4 bombs total** (shared across all lives — no refill on respawn)
- Player may carry and place up to **2 bombs at a time**
- Detonation: **proximity-triggered** — fires when a bug enters blast radius
- Blast radius: 1–2 corridor cells in each cardinal direction from the bomb
- **Bomb kills the player** if they are within blast radius at detonation
- Visual indicator (e.g., pulsing glow) shows a placed bomb is armed and live
- Multi-kill is possible if multiple bugs enter blast radius simultaneously
- Undetonated bombs do not carry over if a bomb is "lost" — once placed, it either detonates or is wasted

**Out of scope for this feature:** scoring credit for bugs caught

---

### Feature 4 — Scoring System

Calculate and display a final score at game end based on path coverage and bugs caught.

**Scope:**

```
Path Score         = (dots collected / total dots) × 100
Bug Score          = (bugs caught / total bugs spawned) × 100
Release Confidence = (Path Score × 0.6) + (Bug Score × 0.4)
```

- Score is calculated at game end (time runs out or all lives lost)
- Game over screen shows breakdown: dots collected, bugs caught, path %, bug %, Release Confidence
- Example runs:

| Dots | Bugs Caught | Path Score | Bug Score | Release Confidence |
|---|---|---|---|---|
| 75 / 100 | 2 / 5 | 75 | 40 | **61** |
| 95 / 100 | 4 / 5 | 95 | 80 | **89** |
| 100 / 100 | 5 / 5 | 100 | 100 | **100** |

**Out of scope for this feature:** leaderboard submission, persistence

---

### Feature 5 — Player Registration & Play Limits

Identity capture before each game and enforcement of the 3-plays-per-day rule.

**Scope:**
- Landing screen shown before every game session
- Player enters: **Name / Nickname** (leaderboard display name) and **Email address** (identity key)
- On submit: server checks play count for that email today
  - If < 3: allow game to start
  - If = 3: show friendly message — *"You've used all 3 attempts for today. Come back tomorrow!"*
- Play count tracked server-side (not localStorage — client-side bypass prevention)
- Email is never displayed publicly — only the nickname appears on the leaderboard

---

### Feature 6 — Leaderboard & Persistence

Persistent score storage, daily best tracking, cumulative 3-day standings, and live leaderboard display.

**Scope:**
- Scores submitted to backend via API at game end
- Database stores: email, nickname, score, timestamp, day number
- **Daily best**: per player per day, only the highest score is surfaced
- **Cumulative score**: sum of each player's daily best across days they've played
- Leaderboard sidebar always visible during gameplay and on all screens
- Leaderboard shows: Rank, Nickname, Day 1 Best, Day 2 Best, Day 3 Best, Cumulative Score
- Updates in real time (or near real time) after each completed game
- On Day 3 end: top 3 winners by cumulative score are highlighted

**Backend stack:**
- Netlify Functions (serverless API)
- Supabase (PostgreSQL) for persistence

---

### Feature 7 — UI / UX & TV Optimisation

Visual design and layout tuned for a large television display in an event setting.

**Scope:**
- Designed for 1080p minimum; 4K-friendly
- All text, scores, and UI elements legible from several feet away
- Arcade aesthetic — high contrast, QA/tech theme
- Layout:
  - **Center/left**: Maze + gameplay (dominant area)
  - **Right sidebar**: Live leaderboard, always visible
  - **Top HUD**: Countdown timer, lives, current score, bombs remaining
- Game states:

| State | Screen |
|---|---|
| Landing | Logo, instructions, Name + Email form, Play button |
| Playing | Maze + HUD + leaderboard sidebar |
| Death | Brief pause overlay, then resume |
| Game Over | Score breakdown, leaderboard rank, Play Again (if attempts remain) |
| Limit Reached | Friendly message + full leaderboard |

---

### Feature 8 — Deployment

Production-ready deployment on Netlify.

**Scope:**
- Static frontend deployed to Netlify
- Netlify Functions for: score submission, play count check, leaderboard fetch
- Environment variables: Supabase connection string, event timezone (`Europe/Oslo`), event start date (Day 1 anchor)
- Single shareable URL for the event
- No install required — playable directly in a modern browser at 60fps

---

## 6. Build Order (Recommended)

| Order | Feature | Why |
|---|---|---|
| 1 | Core Game Engine | Everything else depends on this |
| 2 | Bug AI | Core gameplay loop needs bugs |
| 3 | Bomb Mechanics | Completes the core loop |
| 4 | Scoring System | Closes the game session |
| 5 | Player Registration & Play Limits | Gate before the game starts |
| 6 | Leaderboard & Persistence | Requires backend setup |
| 7 | UI / UX & TV Optimisation | Polish on top of working game |
| 8 | Deployment | Last step before the event |

---

## 7. Decisions Log

All questions resolved — no open items.

| # | Question | Decision |
|---|---|---|
| 1 | Event timezone for day reset? | `Europe/Oslo` (CET/CEST). Fallback: GMT. |
| 2 | Does the leaderboard show scores from all days or only current day? | All days visible, with a cumulative column. Live, in-app, always on screen. |
| 3 | What if a player skips a day? | Missing day treated as 0 in cumulative score. |
| 4 | Is the leaderboard public? | Yes — public URL, no login required to view. |
| 5 | Overall winner calculation? | Sum of daily bests across Day 1 + Day 2 + Day 3. Top 3 announced end of Day 3. |
| 6 | Bomb budget on death/respawn? | 4 bombs total for the full 60s session — no refill on respawn. |
