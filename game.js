/* =====================================================
   Bug Hunter — Game Engine (Feature 1)
   Maze · Player · Dots · Lives · Timer · HUD
   ===================================================== */

// ── Constants ──────────────────────────────────────────
const TILE   = 36;   // px per maze cell
const COLS   = 21;
const ROWS   = 17;
const SPEED  = 6;    // px per step — evenly divides TILE=36 (6 steps/tile); keep tile-aligned
const GAME_SPEED = 0.85;  // global tempo dial — 0.85 = 15% slower (player + bugs together). Tune feel here.
const GAME_DURATION = 45; // seconds of play — short, punchy rounds for an event queue
const PLAYER_HITBOX = 26; // wall-collision box (centered in the 36px cell → 5px clearance)
const TURN_TOL = 10;      // cornering forgiveness: turn within this many px of a tile line

const COLORS = {
  wall:       '#2D1B4E',
  wallBorder: '#5C27F5',
  dot:        '#94A3B8',
  dotEaten:   'transparent',
  player:     '#00B2BD',
  playerGlow: 'rgba(0,178,189,0.4)',
  background: '#1A0B2E',
};

// Player sprite — the Testsigma gear, spins as the player moves
const playerSprite = new Image();
playerSprite.src = 'testsigma-gear.svg';
let playerSpin = 0;

// One fixed color per bug slot (index 0–5); stays the same regardless of mode
const BUG_COLORS = ['#EF4444','#F97316','#EAB308','#EC4899','#A855F7','#22C55E'];
const BUG_GLOWS  = [
  { soft: 'rgba(239,68,68,0.22)',   bright: 'rgba(239,68,68,0.50)'   },
  { soft: 'rgba(249,115,22,0.22)',  bright: 'rgba(249,115,22,0.50)'  },
  { soft: 'rgba(234,179,8,0.22)',   bright: 'rgba(234,179,8,0.50)'   },
  { soft: 'rgba(236,72,153,0.22)',  bright: 'rgba(236,72,153,0.50)'  },
  { soft: 'rgba(168,85,247,0.22)',  bright: 'rgba(168,85,247,0.50)'  },
  { soft: 'rgba(34,197,94,0.22)',   bright: 'rgba(34,197,94,0.50)'   },
];

// ── Bug constants ──────────────────────────────────────
const BUG_SIZE         = TILE - 12; // slightly smaller than player (TILE-6)
const BUG_SPEED_PATROL = 3;
const BUG_SPEED_CHASE  = 4;
const BUG_SPEED_FAST   = 6;
// Six spread-out spawn tiles (path cells, away from player start at col 10 row 16)
const BUG_SPAWN_TILES = [
  { col: 1,  row: 1  },
  { col: 19, row: 1  },
  { col: 1,  row: 6  },
  { col: 19, row: 6  },
  { col: 9,  row: 4  },
  { col: 11, row: 4  },
];

// Row 10 already has open path tiles at both edges — used as the tunnel row
const TUNNEL_ROW = 10;

// ── Maze layout ────────────────────────────────────────
// 1 = wall, 0 = path (dot), 2 = path (no dot / spawn area)
const MAZE_TEMPLATE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,1,0,1],
  [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  [1,1,1,1,0,1,1,1,2,2,2,2,2,1,1,1,0,1,1,1,1],
  [1,1,1,1,0,1,2,2,2,1,1,1,2,2,2,1,0,1,1,1,1],
  [1,1,1,1,0,1,2,1,1,1,1,1,1,1,2,1,0,1,1,1,1],
  [2,2,2,2,0,2,2,1,1,1,1,1,1,1,2,2,0,2,2,2,2],
  [1,1,1,1,0,1,2,1,1,1,1,1,1,1,2,1,0,1,1,1,1],
  [1,1,1,1,0,1,2,2,2,1,1,1,2,2,2,1,0,1,1,1,1],
  [1,1,1,1,0,1,1,1,2,2,2,2,2,1,1,1,0,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
  [1,0,0,1,0,0,0,0,0,0,2,0,0,0,0,0,0,1,0,0,1],
  // row 16 is out of bounds — pad below
].map(r => [...r]); // shallow copy so we can mutate

// Pad to ROWS if needed
while (MAZE_TEMPLATE.length < ROWS) {
  MAZE_TEMPLATE.push(new Array(COLS).fill(1));
}

// ── State ──────────────────────────────────────────────
let canvas, ctx;
let maze, dots;
let player;
let lives, totalLives;
let timeLeft, timerInterval, timerRemainingMs, lastTickAt;
let score;
let totalDots, dotsEaten;
let gameActive, gameOver;
let animFrame;
let deathPause = false;

// Bugs
let bugs = [];
let bugEscalation    = 0;  // 0 = initial, 1 = mid, 2 = late
let bugsCaught       = 0;  // bomb kills — feeds end-game score
let bugsTotalSpawned = 0;  // denominator for bug score

// Bombs
let bombBudget  = 4;   // total bombs left to place (no refill on respawn)
let activeBombs = [];  // currently placed, waiting to detonate
let blastFlash  = null; // { tiles: Set<string>, framesLeft: number }

// Input
const keys = {};
let leaderboardExpanded = true; // always-on for the event display

// ── Init ───────────────────────────────────────────────
function initGame() {
  canvas = document.getElementById('game-canvas');
  ctx    = canvas.getContext('2d');

  scaleCanvas();
  window.addEventListener('resize', scaleCanvas);

  resetGame();
  bindInput();
  showScreen('game');
  renderLeaderboard(); // show current standings in the sidebar from the start
  animFrame = requestAnimationFrame(gameLoop);
  startCountdown();
}

function startCountdown() {
  deathPause = true;
  const overlayEl = document.getElementById('overlay-countdown');
  const numEl     = document.getElementById('countdown-number');
  let   tick      = 3;

  numEl.textContent = tick;
  overlayEl.classList.remove('hidden');

  const interval = setInterval(() => {
    tick -= 1;
    if (tick <= 0) {
      clearInterval(interval);
      overlayEl.classList.add('hidden');
      deathPause = false;
    } else {
      numEl.textContent = tick;
      // re-trigger CSS pop animation
      numEl.classList.remove('countdown-pop-reset');
      void numEl.offsetWidth;
      numEl.style.animation = 'none';
      void numEl.offsetWidth;
      numEl.style.animation = '';
    }
  }, 1000);
}

function scaleCanvas() {
  if (!canvas || !ctx) return;

  // Reserve the real sidebar width (it scales with the viewport on TVs).
  const panel     = document.querySelector('#screen-game .leaderboard-panel');
  const SIDEBAR_W = (leaderboardExpanded && panel) ? panel.offsetWidth + 24 : 0;
  const HUD_H     = 110; // room for the larger, TV-legible HUD
  const PAD       = 48;

  const availW = window.innerWidth  - SIDEBAR_W - PAD;
  const availH = window.innerHeight - HUD_H     - PAD;

  // Fit the maze to the available space — and let it scale UP to fill a TV
  // (no 1× cap), keeping the maze the dominant element on the screen.
  const scale = Math.max(0.1, Math.min(availW / (COLS * TILE), availH / (ROWS * TILE)));
  const cssW  = Math.floor(COLS * TILE * scale);
  const cssH  = Math.floor(ROWS * TILE * scale);
  canvas.style.width  = `${cssW}px`;
  canvas.style.height = `${cssH}px`;

  // Render at device resolution so the upscaled maze stays crisp on 1080p/4K.
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  // Map logical maze coords (COLS*TILE × ROWS*TILE) onto the device-pixel canvas.
  ctx.setTransform(canvas.width / (COLS * TILE), 0, 0, canvas.height / (ROWS * TILE), 0, 0);
}

function toggleLeaderboard() {
  leaderboardExpanded = !leaderboardExpanded;
  const panel = document.querySelector('#screen-game .leaderboard-panel');
  panel.classList.toggle('collapsed', !leaderboardExpanded);
  scaleCanvas();
}

// ── Leaderboard rendering (reads through the data layer) ──
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function medalClass(rank) {
  return rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
}

// True once the event reaches its final day — switches the board into the
// celebratory "winners" reveal (top 3 get the gold/glow treatment + banner).
function isWinnerReveal() {
  const C = BugHunterData.EVENT_CONFIG;
  return BugHunterData.eventDayNumber() >= C.totalDays;
}

// Compact sidebar board: rank · nickname · cumulative
async function renderLeaderboard() {
  const listEl = document.getElementById('leaderboard-list');
  if (!listEl) return;
  const rows = await BugHunterData.getLeaderboard(window.playerEmail);
  if (!rows.length) {
    listEl.innerHTML = '<div class="leaderboard-empty">No scores yet</div>';
    return;
  }
  const reveal = isWinnerReveal();
  listEl.innerHTML = rows.slice(0, 15).map(r => {
    const winner = reveal && r.rank <= 3 ? ' lb-winner' : '';
    const crown  = reveal && r.rank === 1 ? '👑 ' : '';
    return `
    <div class="lb-row${r.isMe ? ' lb-row-me' : ''}${winner}">
      <span class="lb-rank ${medalClass(r.rank)}">${r.rank}</span>
      <span class="lb-name">${crown}${escapeHtml(r.nickname)}</span>
      <span class="lb-score">${r.cumulative}</span>
    </div>`;
  }).join('');
}

// Top-5 teaser on the landing screen (social proof / "be the first" nudge)
async function renderLandingLeaderboard() {
  const listEl = document.getElementById('landing-lb-list');
  if (!listEl) return;
  const rows = await BugHunterData.getLeaderboard();
  if (!rows.length) {
    listEl.innerHTML = '<div class="leaderboard-empty">No scores yet — be the first!</div>';
    return;
  }
  const reveal = isWinnerReveal();
  listEl.innerHTML = rows.slice(0, 5).map(r => {
    const winner = reveal && r.rank <= 3 ? ' lb-winner' : '';
    const crown  = reveal && r.rank === 1 ? '👑 ' : '';
    return `
    <div class="lb-row${winner}">
      <span class="lb-rank ${medalClass(r.rank)}">${r.rank}</span>
      <span class="lb-name">${crown}${escapeHtml(r.nickname)}</span>
      <span class="lb-score">${r.cumulative}</span>
    </div>`;
  }).join('');
}

// Full board with the per-day breakdown (View Leaderboard screen)
async function renderFullLeaderboard() {
  const listEl = document.getElementById('lb-full-list');
  if (!listEl) return;
  const rows   = await BugHunterData.getLeaderboard(window.playerEmail);
  const reveal = isWinnerReveal();
  const banner = document.getElementById('lb-winner-banner');
  if (banner) banner.classList.toggle('hidden', !reveal || !rows.length);
  if (!rows.length) {
    listEl.innerHTML = '<div class="leaderboard-empty">No scores yet</div>';
    return;
  }
  listEl.innerHTML = rows.map(r => {
    const winner = reveal && r.rank <= 3 ? ' lb-winner' : '';
    const crown  = reveal && r.rank === 1 ? '👑 ' : '';
    return `
    <div class="lb-full-row${r.isMe ? ' lb-row-me' : ''}${winner}">
      <span class="lbf-rank ${medalClass(r.rank)}">${r.rank}</span>
      <span class="lbf-name">${crown}${escapeHtml(r.nickname)}</span>
      <span class="lbf-day">${r.dayBests[1] ?? 0}</span>
      <span class="lbf-day">${r.dayBests[2] ?? 0}</span>
      <span class="lbf-day">${r.dayBests[3] ?? 0}</span>
      <span class="lbf-total">${r.cumulative}</span>
    </div>`;
  }).join('');
}

let lbReturnScreen = 'landing';
function showLeaderboardScreen(fromScreen) {
  lbReturnScreen = fromScreen || 'landing';
  renderFullLeaderboard();
  showScreen('leaderboard');
}

function resetGame() {
  maze     = MAZE_TEMPLATE.map(r => [...r]);
  dots     = buildDots();
  totalDots = dots.filter(Boolean).length; // count truthy entries
  dotsEaten = 0;
  simAccum = 0; simLastTs = null; // restart the fixed-timestep clock
  lives    = 3;
  totalLives = 3;
  timeLeft = GAME_DURATION;
  score    = 0;
  gameActive = true;
  gameOver   = false;
  deathPause = false;

  bugs             = [];
  bugEscalation    = 0;
  bugsCaught       = 0;
  bugsTotalSpawned = 0;
  spawnBugs(3);

  bombBudget  = 4;
  activeBombs = [];
  blastFlash  = null;

  player = {
    // pixel position (top-left of sprite)
    x: 10 * TILE,
    y: 16 * TILE,
    // movement direction (px/frame)
    dx: 0,
    dy: 0,
    // queued next direction
    nextDx: 0,
    nextDy: 0,
    size: TILE - 6,
  };

  updateHUD();
  startTimer();
}

// Build a flat dots array indexed by row*COLS+col
function buildDots() {
  const d = new Array(ROWS * COLS).fill(false);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (maze[r][c] === 0) d[r * COLS + c] = true;
    }
  }
  return d;
}

// ── Timer ──────────────────────────────────────────────
const DEBUG = new URLSearchParams(location.search).has('debug');

function startTimer() {
  clearInterval(timerInterval);
  // Wall-clock based: measure real elapsed play-time so the countdown is
  // immune to setInterval drift when the game loop is busy. Paused time
  // (start countdown, death freeze) does not accrue.
  timerRemainingMs = (DEBUG ? 10 : GAME_DURATION) * 1000;
  timeLeft   = Math.ceil(timerRemainingMs / 1000);
  lastTickAt = null;
  updateHUD(); // show the correct starting time immediately (no stale value)
  timerInterval = setInterval(tickTimer, 100); // 10x/s for smooth, accurate ticks
}

function tickTimer() {
  if (!gameActive) return;
  const now = performance.now();
  // While paused, don't accrue time — just keep the reference point current.
  if (deathPause) { lastTickAt = now; return; }
  if (lastTickAt === null) { lastTickAt = now; return; }

  timerRemainingMs -= now - lastTickAt;
  lastTickAt = now;

  const secs = Math.max(0, Math.ceil(timerRemainingMs / 1000));
  if (secs !== timeLeft) {
    timeLeft = secs;
    updateHUD();
    checkBugEscalation();
  }
  if (timerRemainingMs <= 0) endGame();
}

// ── Input ──────────────────────────────────────────────
let inputBound = false;
function bindInput() {
  if (inputBound) return; // attach listeners exactly once for the whole session
  inputBound = true;

  document.addEventListener('keydown', e => {
    // Never intercept keys while typing in a form field, or outside gameplay.
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (!gameActive) return;

    keys[e.key] = true;
    switch (e.key) {
      case 'ArrowUp':    case 'w': case 'W': player.nextDx=0;  player.nextDy=-SPEED; break;
      case 'ArrowDown':  case 's': case 'S': player.nextDx=0;  player.nextDy= SPEED; break;
      case 'ArrowLeft':  case 'a': case 'A': player.nextDx=-SPEED; player.nextDy=0; break;
      case 'ArrowRight': case 'd': case 'D': player.nextDx= SPEED; player.nextDy=0; break;
      case ' ': case 'b': case 'B': placeBomb(); break;
      case 'l': case 'L': toggleLeaderboard(); return; // don't preventDefault
    }
    e.preventDefault();
  });
  document.addEventListener('keyup',  e => { keys[e.key] = false; });
}

// ── Collision helpers ──────────────────────────────────
function tileAt(px, py) {
  let col = Math.floor(px / TILE);
  const row = Math.floor(py / TILE);
  if (row < 0 || row >= ROWS) return 1;
  if (col < 0 || col >= COLS) {
    if (row === TUNNEL_ROW) col = ((col % COLS) + COLS) % COLS; // wrap through tunnel
    else return 1;
  }
  return maze[row][col];
}

// Can a `size`px box, centered within its cell, occupy the cell at (px, py)?
// The box is centered so the sprite and its collision box share one center —
// this is what keeps the gear from ever poking past where collision allows.
function canMoveAt(px, py, size) {
  const off = (TILE - size) / 2; // centering inset
  return (
    tileAt(px + off,        py + off)        !== 1 &&
    tileAt(px + off + size, py + off)        !== 1 &&
    tileAt(px + off,        py + off + size)  !== 1 &&
    tileAt(px + off + size, py + off + size)  !== 1
  );
}

function canMove(px, py) { return canMoveAt(px, py, PLAYER_HITBOX); }

// Snap to nearest tile boundary (used for turns at junctions)
function snapToGrid(v) {
  return Math.round(v / TILE) * TILE;
}

// Direction-aware snap when stopping at a wall. With a centered hitbox the
// entity already halts tile-aligned, so we just settle onto that boundary.
function snapOnHit(v, dv) {
  if (dv > 0) return Math.floor(v / TILE) * TILE; // moving positive → land on the cell we're in
  if (dv < 0) return Math.ceil(v / TILE) * TILE;  // moving negative → land on the cell we're in
  return snapToGrid(v);
}

// ── Bug AI ────────────────────────────────────────────

function spawnBug(spawnIdx) {
  const tile  = BUG_SPAWN_TILES[spawnIdx % BUG_SPAWN_TILES.length];
  const cIdx  = bugs.length % BUG_COLORS.length;
  bugs.push({
    x:     tile.col * TILE,
    y:     tile.row * TILE,
    dx:    0,
    dy:    BUG_SPEED_PATROL,
    mode:  'patrol',
    speed: BUG_SPEED_PATROL,
    size:  BUG_SIZE,
    color: BUG_COLORS[cIdx],
    glow:  BUG_GLOWS[cIdx],
  });
  bugsTotalSpawned++;
}

function spawnBugs(count) {
  for (let i = 0; i < count; i++) spawnBug(bugs.length);
}

function escalateBugs1() {
  spawnBug(bugs.length); // 4th bug
  let assigned = 0;
  for (const bug of bugs) {
    if (assigned < 2) { bug.mode = 'chase'; bug.speed = BUG_SPEED_CHASE; assigned++; }
  }
}

function escalateBugs2() {
  while (bugs.length < 6) spawnBug(bugs.length); // 5th and 6th
  for (const bug of bugs) { bug.mode = 'chase'; bug.speed = BUG_SPEED_FAST; }
}

function checkBugEscalation() {
  // Escalate at 2/3 and 1/3 of the round remaining, scaled to GAME_DURATION.
  if (bugEscalation === 0 && timeLeft <= GAME_DURATION * 2 / 3) {
    bugEscalation = 1;
    escalateBugs1();
  } else if (bugEscalation === 1 && timeLeft <= GAME_DURATION / 3) {
    bugEscalation = 2;
    escalateBugs2();
  }
}

// BFS shortest path from bug tile to player tile.
// Returns a unit direction {dx, dy} for the first step, or null if no path.
function bfsDirection(fromX, fromY, toX, toY) {
  const sc = Math.round(fromX / TILE);
  const sr = Math.round(fromY / TILE);
  const gc = Math.round(toX   / TILE);
  const gr = Math.round(toY   / TILE);
  if (sc === gc && sr === gr) return null;

  const DIRS = [
    { dc: 1, dr: 0, dx: 1, dy: 0 }, { dc: -1, dr: 0, dx: -1, dy: 0 },
    { dc: 0, dr: 1, dx: 0, dy: 1 }, { dc:  0, dr: -1, dx: 0, dy: -1 },
  ];
  const queue   = [{ col: sc, row: sr, dir: null }];
  const visited = new Set([`${sc},${sr}`]);

  while (queue.length > 0) {
    const { col, row, dir } = queue.shift();
    for (const d of DIRS) {
      const nc = col + d.dc, nr = row + d.dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      if (maze[nr][nc] === 1) continue;
      const key = `${nc},${nr}`;
      if (visited.has(key)) continue;
      const firstDir = dir ?? { dx: d.dx, dy: d.dy };
      if (nc === gc && nr === gr) return firstDir;
      visited.add(key);
      queue.push({ col: nc, row: nr, dir: firstDir });
    }
  }
  return null;
}

function pickPatrolDir(bug) {
  const DIRS = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx:  0, dy: -1 },
  ];
  // Fisher-Yates shuffle for random wandering
  for (let i = DIRS.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [DIRS[i], DIRS[j]] = [DIRS[j], DIRS[i]];
  }
  const curNx   = bug.dx !== 0 ? Math.sign(bug.dx) : 0;
  const curNy   = bug.dy !== 0 ? Math.sign(bug.dy) : 0;
  const moving  = curNx !== 0 || curNy !== 0;
  const ordered = moving
    ? [...DIRS.filter(d => !(d.dx === -curNx && d.dy === -curNy)), { dx: -curNx, dy: -curNy }]
    : DIRS;

  for (const d of ordered) {
    if (canMoveAt(bug.x + d.dx * TILE, bug.y + d.dy * TILE, bug.size)) {
      bug.dx = d.dx * bug.speed;
      bug.dy = d.dy * bug.speed;
      return;
    }
  }
}

function moveBug(bug) {
  // All bug speeds (3, 4, 6) evenly divide TILE=36, so bugs land on exact tile coords.
  // Re-evaluate direction at every tile boundary.
  if (bug.x % TILE === 0 && bug.y % TILE === 0) {
    if (bug.mode === 'chase') {
      const dir = bfsDirection(bug.x, bug.y, player.x, player.y);
      if (dir) { bug.dx = dir.dx * bug.speed; bug.dy = dir.dy * bug.speed; }
      else      { pickPatrolDir(bug); } // fallback: wander when cornered
    } else {
      pickPatrolDir(bug);
    }
  }

  const nx = bug.x + bug.dx;
  const ny = bug.y + bug.dy;
  if (canMoveAt(nx, ny, bug.size)) {
    bug.x = nx;
    bug.y = ny;
  } else {
    bug.x = snapOnHit(bug.x, bug.dx);
    bug.y = snapOnHit(bug.y, bug.dy);
    bug.dx = 0;
    bug.dy = 0;
  }

  // Tunnel warp
  if (Math.round(bug.y / TILE) === TUNNEL_ROW) {
    if (bug.x <= -TILE)            bug.x += COLS * TILE;
    else if (bug.x >= COLS * TILE) bug.x -= COLS * TILE;
  }
}

function moveBugs() {
  if (!gameActive || deathPause) return;
  for (const bug of bugs) moveBug(bug);
}

function checkBugCollisions() {
  if (!gameActive || deathPause) return;
  const hitMargin = 8; // forgiveness so grazing doesn't kill
  for (const bug of bugs) {
    if (
      player.x + hitMargin         < bug.x + bug.size &&
      player.x + player.size - hitMargin > bug.x &&
      player.y + hitMargin         < bug.y + bug.size &&
      player.y + player.size - hitMargin > bug.y
    ) {
      triggerDeath();
      return;
    }
  }
}

// ── Player movement ────────────────────────────────────

function movePlayer() {
  if (!gameActive || deathPause) return;

  // ── Direction changes (Pac-Man style) ────────────────
  // The desired direction (nextDx/nextDy, set on keypress) persists until it
  // can be satisfied, so an early or late press is never dropped — the turn
  // happens at the next opportunity. Reversals flip instantly.
  const wantNew = player.nextDx !== player.dx || player.nextDy !== player.dy;
  if (wantNew) {
    const reversal = (player.nextDx === -player.dx && player.dx !== 0) ||
                     (player.nextDy === -player.dy && player.dy !== 0);
    if (reversal) {
      player.dx = player.nextDx;
      player.dy = player.nextDy;
    } else {
      // Perpendicular / from-stop turn: allowed within a cornering window
      // (TURN_TOL px before or after a tile line), snapping onto the line so
      // the new corridor lines up. Only turns if that corridor is open.
      const sx = snapToGrid(player.x);
      const sy = snapToGrid(player.y);
      const aligned = Math.abs(player.x - sx) <= TURN_TOL &&
                      Math.abs(player.y - sy) <= TURN_TOL;
      if (aligned && canMove(sx + player.nextDx, sy + player.nextDy)) {
        player.x = sx; player.y = sy;
        player.dx = player.nextDx; player.dy = player.nextDy;
      }
    }
  }

  // Move in current direction
  const nx = player.x + player.dx;
  const ny = player.y + player.dy;
  if (canMove(nx, ny)) {
    player.x = nx;
    player.y = ny;
  } else {
    player.x = snapOnHit(player.x, player.dx);
    player.y = snapOnHit(player.y, player.dy);
    player.dx = 0;
    player.dy = 0;
  }

  eatDot();

  // Tunnel warp — row 10 connects both edges of the maze
  if (Math.round(player.y / TILE) === TUNNEL_ROW) {
    if (player.x <= -TILE)            player.x += COLS * TILE;
    else if (player.x >= COLS * TILE) player.x -= COLS * TILE;
  }
}

function eatDot() {
  const col = Math.round(player.x / TILE);
  const row = Math.round(player.y / TILE);
  const idx = row * COLS + col;
  if (dots[idx]) {
    dots[idx] = false;
    dotsEaten++;
    updateHUD();
    if (dotsEaten >= totalDots) endGame(); // all dots eaten
  }
}

// ── Bomb Mechanics ─────────────────────────────────────

function placeBomb() {
  if (!gameActive || deathPause) return;
  if (bombBudget <= 0 || activeBombs.length >= 2) return;

  const col = Math.round(player.x / TILE);
  const row = Math.round(player.y / TILE);

  // Don't stack two bombs on the same tile
  if (activeBombs.some(b => b.col === col && b.row === row)) return;

  activeBombs.push({ col, row, pulsePhase: 0 });
  bombBudget--;
  updateHUD();
}

// Returns the Set of "col,row" strings within blast range of a bomb.
// Blast travels up to 2 corridor cells in each cardinal direction, stops at walls.
function getBombBlastTiles(bomb) {
  const tiles = new Set([`${bomb.col},${bomb.row}`]);
  const DIRS  = [{ dc: 1, dr: 0 }, { dc: -1, dr: 0 }, { dc: 0, dr: 1 }, { dc: 0, dr: -1 }];
  for (const d of DIRS) {
    for (let step = 1; step <= 2; step++) {
      const nc = bomb.col + d.dc * step;
      const nr = bomb.row + d.dr * step;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) break;
      if (maze[nr][nc] === 1) break; // wall absorbs blast
      tiles.add(`${nc},${nr}`);
    }
  }
  return tiles;
}

function detonateBomb(bombIdx, blastTiles) {
  activeBombs.splice(bombIdx, 1);

  // Kill every bug whose tile overlaps the blast
  for (let i = bugs.length - 1; i >= 0; i--) {
    const bc = Math.round(bugs[i].x / TILE);
    const br = Math.round(bugs[i].y / TILE);
    if (blastTiles.has(`${bc},${br}`)) {
      bugs.splice(i, 1);
      bugsCaught++;
    }
  }

  // Kill player if caught in blast
  const pc = Math.round(player.x / TILE);
  const pr = Math.round(player.y / TILE);
  if (blastTiles.has(`${pc},${pr}`)) triggerDeath();

  showBlast(blastTiles);
  updateHUD();
}

function checkBombDetonations() {
  if (!gameActive || deathPause) return;
  for (let i = activeBombs.length - 1; i >= 0; i--) {
    const blastTiles = getBombBlastTiles(activeBombs[i]);
    for (const bug of bugs) {
      const bc = Math.round(bug.x / TILE);
      const br = Math.round(bug.y / TILE);
      if (blastTiles.has(`${bc},${br}`)) {
        detonateBomb(i, blastTiles);
        break; // bomb is gone; move to next bomb index
      }
    }
  }
}

function showBlast(tiles) {
  blastFlash = { tiles, framesLeft: 22 };
}

// ── Death ──────────────────────────────────────────────
function triggerDeath() {
  if (deathPause) return;
  deathPause = true;
  lives--;
  updateHUD();

  const overlay = document.getElementById('overlay-death');
  overlay.classList.remove('hidden');

  setTimeout(() => {
    overlay.classList.add('hidden');
    if (lives <= 0) {
      endGame();
    } else {
      respawnPlayer();
      deathPause = false;
    }
  }, 1500);
}

function respawnPlayer() {
  player.x    = 10 * TILE;
  player.y    = 16 * TILE;
  player.dx   = 0;
  player.dy   = 0;
  player.nextDx = 0;
  player.nextDy = 0;
}

// ── Scoring ────────────────────────────────────────────

// Live formula score (0–100), kept in sync with the final calculation.
function computeLiveScore() {
  const pathPct = totalDots > 0 ? (dotsEaten / totalDots) * 100 : 0;
  const bugPct  = bugsTotalSpawned > 0 ? (bugsCaught / bugsTotalSpawned) * 100 : 0;
  return Math.round(pathPct * 0.6 + bugPct * 0.4);
}

// ── End Game ───────────────────────────────────────────
async function endGame() {
  gameActive = false;
  clearInterval(timerInterval);

  const pathPct    = totalDots > 0 ? Math.round((dotsEaten / totalDots) * 100) : 0;
  const bugPct     = bugsTotalSpawned > 0 ? Math.round((bugsCaught / bugsTotalSpawned) * 100) : 0;
  const finalScore = Math.round(pathPct * 0.6 + bugPct * 0.4);

  const titleEl    = document.getElementById('go-title');
  const subtitleEl = document.getElementById('go-subtitle');
  if (finalScore >= 80) {
    titleEl.textContent    = 'SAFE TO SHIP';
    titleEl.className      = 'gameover-title passed';
    subtitleEl.textContent = 'Release unblocked — ship it';
  } else if (finalScore > 60) {
    titleEl.textContent    = 'CONDITIONAL GO';
    titleEl.className      = 'gameover-title conditional';
    subtitleEl.textContent = 'Ship with caution — a few bugs slipped through';
  } else {
    titleEl.textContent    = 'BUILD FAILED';
    titleEl.className      = 'gameover-title failed';
    subtitleEl.textContent = 'Bugs reached production';
  }

  document.getElementById('go-paths-raw').textContent = `${dotsEaten} / ${totalDots}`;
  document.getElementById('go-bugs-raw').textContent  = `${bugsCaught} / ${bugsTotalSpawned}`;
  document.getElementById('go-paths').textContent     = `${pathPct}%`;
  document.getElementById('go-bugs').textContent      = `${bugPct}%`;
  document.getElementById('go-final').textContent     = String(finalScore).padStart(3, '0');

  cancelAnimationFrame(animFrame);

  // Persist this play. The daily limit is re-checked at registration when
  // the next game starts, so no per-button gating is needed here.
  const rankEl = document.getElementById('go-rank');
  rankEl.classList.add('hidden');
  if (window.playerEmail) {
    await BugHunterData.recordPlay({
      email:    window.playerEmail,
      nickname: window.playerName,
      score:    finalScore,
    });
    // Show where this player now stands.
    const board = await BugHunterData.getLeaderboard(window.playerEmail);
    const me    = board.find(r => r.isMe);
    if (me) {
      rankEl.innerHTML =
        `Rank <span class="go-rank-num">#${me.rank}</span> of ${board.length}` +
        ` · ${me.cumulative} pts cumulative`;
      rankEl.classList.remove('hidden');
    }
    renderLeaderboard(); // refresh the sidebar with the new score
  }

  showScreen('gameover');
}

// ── HUD ────────────────────────────────────────────────
function updateHUD() {
  const timerEl = document.getElementById('hud-timer');
  timerEl.textContent = String(timeLeft).padStart(2, '0');
  timerEl.classList.toggle('warning', timeLeft <= 10 && timeLeft > 5);
  timerEl.classList.toggle('danger',  timeLeft <= 5);

  score = computeLiveScore(); // keep live score in sync with the final formula
  document.getElementById('hud-score').textContent = String(score).padStart(3, '0');
  document.getElementById('hud-bombs').textContent = bombBudget;

  const livesEl = document.getElementById('hud-lives');
  livesEl.innerHTML = '';
  for (let i = 0; i < totalLives; i++) {
    const dot = document.createElement('div');
    dot.className = 'life-dot' + (i >= lives ? ' lost' : '');
    livesEl.appendChild(dot);
  }
}

// ── Rendering ──────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, COLS * TILE, ROWS * TILE); // logical bounds (ctx is scaled)
  drawMaze();
  drawGrid();
  drawDots();
  drawBombs();  // under bugs so bugs walk "over" placed bombs
  drawBlast();  // explosion flash on top of bombs but under entities
  drawBugs();
  drawPlayer();
}

function drawMaze() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE, y = r * TILE;
      if (maze[r][c] === 1) {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(x, y, TILE, TILE);
        // subtle border
        ctx.strokeStyle = COLORS.wallBorder;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      } else {
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = 'rgba(92, 39, 245, 0.13)';
  ctx.lineWidth = 0.5;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (maze[r][c] !== 1) {
        ctx.strokeRect(c * TILE + 0.5, r * TILE + 0.5, TILE, TILE);
      }
    }
  }
  ctx.restore();
}

function drawDots() {
  const DOT_R = 4;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (dots[r * COLS + c]) {
        ctx.beginPath();
        ctx.arc(
          c * TILE + TILE / 2,
          r * TILE + TILE / 2,
          DOT_R, 0, Math.PI * 2
        );
        ctx.fillStyle = COLORS.dot;
        ctx.fill();
      }
    }
  }
}

function drawPlayer() {
  // Draw on the true tile center, shared with the collision box.
  const cx = player.x + TILE / 2;
  const cy = player.y + TILE / 2;

  // Subtle glow kept inside the cell (radius < half-tile) so it never bleeds
  // into adjacent walls.
  const glowR = 15;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
  grad.addColorStop(0, COLORS.playerGlow);
  grad.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Upright gear (brand stays readable) with a subtle breathing pulse.
  playerSpin += 0.08; // a time phase, not a rotation
  const pulse = 1 + Math.sin(playerSpin) * 0.04;

  if (playerSprite.complete && playerSprite.naturalWidth) {
    // 24px ≤ PLAYER_HITBOX (26), both centered → the gear can never extend
    // past where collision allows, so it never overlaps a wall.
    const size = 24 * pulse;
    ctx.drawImage(playerSprite, cx - size / 2, cy - size / 2, size, size);
  } else {
    // fallback to the teal dot until the sprite loads
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.player;
    ctx.fill();
  }
}

function drawBugs() {
  for (const bug of bugs) {
    const cx      = bug.x + bug.size / 2 + 6;
    const cy      = bug.y + bug.size / 2 + 6;
    const r       = bug.size / 2;
    const chasing = bug.mode === 'chase';
    const glowClr = chasing ? bug.glow.bright : bug.glow.soft;

    // Glow
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.7);
    grad.addColorStop(0, glowClr);
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.7, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Chase ring — white outline signals aggression regardless of color
    if (chasing) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }

    // Body
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = bug.color;
    ctx.fill();

    // Eyes face toward movement direction
    const ex = bug.dx > 0 ? 3 : bug.dx < 0 ? -3 : 0;
    const ey = bug.dy > 0 ? 3 : bug.dy < 0 ? -3 : 0;
    ctx.fillStyle = COLORS.background;
    ctx.beginPath(); ctx.arc(cx + ex - 3, cy + ey - 2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + ex + 3, cy + ey - 2, 2, 0, Math.PI * 2); ctx.fill();

    // Antennae
    ctx.strokeStyle = bug.color;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 3, cy - r); ctx.lineTo(cx - 6, cy - r - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 3, cy - r); ctx.lineTo(cx + 6, cy - r - 5); ctx.stroke();

    // Legs (3 pairs)
    for (let i = 0; i < 3; i++) {
      const ly = cy - r * 0.3 + i * (r * 0.38);
      ctx.beginPath(); ctx.moveTo(cx - r, ly); ctx.lineTo(cx - r - 5, ly - 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + r, ly); ctx.lineTo(cx + r + 5, ly - 3); ctx.stroke();
    }
  }
}

function drawBombs() {
  for (const bomb of activeBombs) {
    bomb.pulsePhase = (bomb.pulsePhase + 0.09) % (Math.PI * 2);
    const pulse = 0.5 + 0.5 * Math.sin(bomb.pulsePhase); // 0→1

    const cx = bomb.col * TILE + TILE / 2;
    const cy = bomb.row * TILE + TILE / 2;
    const r  = 8 + pulse * 3; // 8–11 px, breathing

    // Outer glow
    const glowR = r * 2.8 + pulse * 5;
    const grad  = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    grad.addColorStop(0, `rgba(229,128,134,${0.35 + pulse * 0.25})`);
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Body (pink — --color-accent)
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#E58086';
    ctx.fill();

    // Fuse spark (yellow, pulses brighter)
    ctx.beginPath();
    ctx.arc(cx + 5, cy - r - 3, 2 + pulse * 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(251,191,36,${0.6 + pulse * 0.4})`;
    ctx.fill();
  }
}

function drawBlast() {
  if (!blastFlash || blastFlash.framesLeft <= 0) return;
  const alpha = blastFlash.framesLeft / 22;

  // Fill each blast tile with a fading purple
  ctx.fillStyle = `rgba(92,39,245,${alpha * 0.55})`;
  for (const key of blastFlash.tiles) {
    const [c, r] = key.split(',').map(Number);
    ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
  }

  // Bright pink border on each tile
  ctx.strokeStyle = `rgba(229,128,134,${alpha})`;
  ctx.lineWidth   = 2;
  for (const key of blastFlash.tiles) {
    const [c, r] = key.split(',').map(Number);
    ctx.strokeRect(c * TILE + 1, r * TILE + 1, TILE - 2, TILE - 2);
  }

  blastFlash.framesLeft--;
  if (blastFlash.framesLeft <= 0) blastFlash = null;
}

// ── Game Loop ──────────────────────────────────────────
// Fixed-timestep simulation: movement advances on a clock, not per animation
// frame, so speed is identical on 60 / 120 / 144 Hz displays. The step rate is
// 90% of the 60fps baseline → everything moves 10% slower. Rendering still
// happens every frame for smoothness.
const SIM_STEP_MS = (1000 / 60) / GAME_SPEED; // 60fps baseline ÷ tempo → 10% slower at 0.9
let   simAccum    = 0;
let   simLastTs   = null;

function gameLoop(ts) {
  if (simLastTs === null) simLastTs = ts;
  let dt = ts - simLastTs;
  simLastTs = ts;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  if (dt > 250) dt = SIM_STEP_MS; // tab was hidden — don't burst-catch-up

  simAccum += dt;
  let steps = 0;
  while (simAccum >= SIM_STEP_MS && steps < 5) { // cap catch-up per frame
    moveBugs();
    movePlayer();
    checkBombDetonations();
    checkBugCollisions();
    simAccum -= SIM_STEP_MS;
    steps++;
  }
  if (steps === 5) simAccum = 0; // drop any remaining backlog

  draw();
  animFrame = requestAnimationFrame(gameLoop);
}

// ── Screen management ──────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
}

// ── Registration form ──────────────────────────────────
document.getElementById('form-register').addEventListener('submit', async e => {
  e.preventDefault();
  const name  = document.getElementById('input-name').value.trim();
  const email = document.getElementById('input-email').value.trim();
  const errEl = document.getElementById('form-error');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (!name) { showError(errEl, 'Please enter your name or nickname.'); return; }
  if (!isValidEmail(email)) { showError(errEl, 'Please enter a valid email address.'); return; }

  errEl.classList.add('hidden');

  // Enforce the daily play limit before starting (PRD Feature 5).
  submitBtn.disabled = true;
  const remaining = await BugHunterData.attemptsRemaining(email);
  submitBtn.disabled = false;

  // Store for later use (score submission etc.)
  window.playerName  = name;
  window.playerEmail = email;

  if (remaining <= 0) { showScreen('limit'); return; }

  window.attemptsRemaining = remaining;
  initGame();
});

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function isValidEmail(v) {
  // Email is an identity key (never emailed), so the goal is to reject garbage
  // and typos that would fragment a player's scores — not full RFC validation.
  // Requires: single @, a dotted domain with valid labels, and a TLD of >=2 letters.
  const email = String(v).trim();
  if (email.length < 6 || email.length > 254) return false;
  if (email.includes('..')) return false; // no consecutive dots
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(email);
}

// ── "Did you mean…" suggestions for common provider typos ──
const COMMON_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'yahoo.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com',
  'aol.com', 'testsigma.com',
];

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

// Returns a corrected email if the domain is a near-miss of a common provider, else null.
function suggestEmail(email) {
  const e  = String(email).trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1) return null;
  const local = e.slice(0, at), domain = e.slice(at + 1);
  if (!domain || COMMON_EMAIL_DOMAINS.includes(domain)) return null;
  let best = null, bestDist = 3; // only suggest within edit-distance 1–2
  for (const d of COMMON_EMAIL_DOMAINS) {
    const dist = levenshtein(domain, d);
    if (dist > 0 && dist < bestDist) { bestDist = dist; best = d; }
  }
  return best ? `${local}@${best}` : null;
}

(function wireEmailSuggestions() {
  const input   = document.getElementById('input-email');
  const suggest = document.getElementById('email-suggest');
  if (!input || !suggest) return;

  input.addEventListener('blur', () => {
    const s = suggestEmail(input.value);
    if (s && s !== input.value.trim().toLowerCase()) {
      suggest.innerHTML = `Did you mean <button type="button" class="email-suggest-btn">${escapeHtml(s)}</button>?`;
      suggest.classList.remove('hidden');
      suggest.querySelector('button').addEventListener('click', () => {
        input.value = s;
        suggest.classList.add('hidden');
      });
    } else {
      suggest.classList.add('hidden');
    }
  });

  input.addEventListener('input', () => suggest.classList.add('hidden'));
})();

// ── New Game ───────────────────────────────────────────
// Each game is its own session: return to registration for a fresh player/email.
document.getElementById('btn-play-again').addEventListener('click', () => {
  cancelAnimationFrame(animFrame);
  clearInterval(timerInterval);
  gameActive = false;
  resetRegistration();
  showScreen('landing');
  renderLandingLeaderboard(); // refresh standings for the next player
});

function resetRegistration() {
  document.getElementById('input-name').value  = '';
  document.getElementById('input-email').value = '';
  document.getElementById('form-error').classList.add('hidden');
  window.playerName = window.playerEmail = null;
  window.attemptsRemaining = undefined;
}

document.getElementById('btn-leaderboard').addEventListener('click', () => {
  showLeaderboardScreen('gameover');
});

document.getElementById('btn-limit-lb').addEventListener('click', () => {
  showLeaderboardScreen('limit');
});

document.getElementById('btn-lb-back').addEventListener('click', () => {
  showScreen(lbReturnScreen);
});

// Populate the landing top-5 on first load (the default visible screen).
renderLandingLeaderboard();
