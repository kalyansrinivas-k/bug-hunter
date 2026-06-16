# bug hunt — Event Guide

A QA-themed arcade game by Testsigma. Navigate the maze, cover every path, and
catch the bugs before they reach production.

- **Play at:** https://testsigma-bug-hunter.netlify.app/
- **Event dates:** June 16–18, 2026 (3 days)
- **Winners:** Top 3 by cumulative score, announced at the end of Day 3

---

## 1. For Players

### Signing up
Before each game you'll enter:
- **A name / nickname** — this is what shows on the public leaderboard.
- **Your email address.**

> **📧 Please use your real email address.** It's how we'll **notify you if you
> win** when results are announced. Your email is **never shown publicly** — only
> your nickname appears on the leaderboard. (If you mistype a common domain, the
> game will gently suggest a correction.)

### The goal
You're a tester loose in the codebase. In **45 seconds**, you want to:
- **Cover paths** — collect the dots lining every corridor (this is your test coverage).
- **Catch bugs** — drop bombs to take out the bugs roaming the maze.
- **Stay alive** — you have **3 lives**; touching a bug costs one.

### Controls
| Action | Keys |
|---|---|
| Move | Arrow keys or **W A S D** |
| Place a bomb | **Space** or **B** |
| Show/hide the leaderboard | **L** |

- You get **4 bombs per game** (max 2 placed at once). A bomb goes off when a bug
  gets close — but it'll catch **you** too if you're in the blast, so place wisely.

### Your score — "Release Confidence" (0–100)
```
Release Confidence = (path coverage × 60%) + (bugs caught × 40%)
```
| Score | Verdict |
|---|---|
| 80–100 | ✅ **Safe to Ship** |
| 61–79  | ⚠️ **Conditional Go** |
| 0–60   | ❌ **Build Failed** |

### The rules
- You may play up to **3 times per day**, each day of the event.
- Only your **best score each day** counts.
- Your **event total** = your best score on Day 1 + Day 2 + Day 3.
- The **top 3 by total** win, announced at the end of Day 3.
- The leaderboard is live — watch your rank climb in real time.

### Quick tips
- Coverage is weighted highest — don't ignore the dots while chasing bugs.
- Bombs are limited; bait a bug close before it triggers.
- A clean run beats a risky one — dying resets you to the start and burns clock.

---

## 2. For Organizers

### What you need at the booth
- A laptop (any 60 Hz screen is fine — speed is consistent across displays) and,
  ideally, a **large TV/monitor** showing the game so the live leaderboard is visible.
- Open the game URL in a modern browser, full-screen. No install required.
- Players can play on the booth machine (kiosk style) **or** their own laptops at
  the same URL — both work; scores share one leaderboard.

### One-time setup on the morning of **Day 1 (June 16)**
Before opening the booth, **reset the leaderboard** to clear any pre-event test
scores. In the Supabase **SQL Editor**, run:
```sql
delete from plays;
```
After this, only real event scores count. (Full details in [`BACKEND.md`](BACKEND.md).)

> The leaderboard intentionally shows scores **before** the event too (for demos /
> warm-up), which is why this one-time clear is needed on Day 1.

### During the event — what's automatic (nothing to do daily)
- **Daily play limit:** 3 plays per email per day, enforced server-side. A player
  who's used all 3 sees a friendly "That's a wrap — come back tomorrow" screen.
  This resets on its own at **midnight Oslo time** each day.
- **Daily best & totals:** the system keeps each player's best per day and sums the
  three days automatically.
- **Day-3 winner reveal:** on the final day the leaderboard automatically highlights
  the **top 3** with a gold "🏆 Event Winners" banner.

### Determining & notifying the winners
- Winners are the **top 3 by cumulative total** (best of Day 1 + Day 2 + Day 3).
- To get the winners' names **and emails** (emails aren't shown in the app), run this
  in the Supabase SQL Editor:
  ```sql
  select rank, nickname, email, cumulative
  from leaderboard
  order by rank
  limit 10;
  ```
- Email the winners using the addresses they registered with.
  - _[Organizers: confirm prize details and the exact announcement time/place.]_

### Troubleshooting
- **Leaderboard shows "No scores yet" during the event:** confirm scores are being
  written — check the Netlify environment variables (`SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `EVENT_START_DATE`, `EVENT_TIMEZONE`) and that the
  site has been redeployed since they were set.
- **A player can't start a game:** they've likely used their 3 plays for the day, or
  entered an invalid email — check the on-screen message.
- **Game won't load:** confirm the Netlify deploy is live and the device is online.

### Data & privacy
- Stored per play: nickname, email, score, day, timestamp.
- **Emails are never shown publicly** — only on screen to organizers via the query
  above, used solely to notify winners.

---

_Questions or issues during the event? Contact [Organizers: add a name / Slack channel]._
