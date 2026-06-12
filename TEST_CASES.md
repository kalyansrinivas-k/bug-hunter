# Bug Hunter — Test Cases & Edge Cases

---

## Feature 3 — Bomb Mechanics

### EC-01 · Placed bomb persists through player death

**Scenario:** Player places a bomb, then dies to a bug before the bomb detonates.

**Observed behavior:** The bomb remains on the map after the player respawns.

**Expected / intended behavior:** This is by design — the bomb was already placed and the budget already decremented. Removing it silently on death would waste a resource the player spent. If a bug walks over it during or after respawn, it detonates normally.

**Edge to watch:** If the player respawns and immediately walks back over their own bomb, they could detonate it themselves and lose another life. No grace period is currently applied to placed bombs after respawn.

**Status:** Accepted behavior — revisit if playtesting feedback suggests it feels unfair.

---
