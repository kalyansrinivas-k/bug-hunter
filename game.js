/* =====================================================
   Bug Hunter — Game Engine (Feature 1)
   Maze · Player · Dots · Lives · Timer · HUD
   ===================================================== */

// ── Constants ──────────────────────────────────────────
const TILE   = 36;   // px per maze cell
const COLS   = 21;
const ROWS   = 17;
const SPEED  = 6;    // px per frame — evenly divides TILE=36 (6 frames/tile)

const COLORS = {
  wall:       '#2D1B4E',
  wallBorder: '#5C27F5',
  dot:        '#94A3B8',
  dotEaten:   'transparent',
  player:     '#00B2BD',
  playerGlow: 'rgba(0,178,189,0.4)',
  background: '#1A0B2E',
};

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
let timeLeft, timerInterval;
let score;
let totalDots, dotsEaten;
let gameActive, gameOver;
let animFrame;
let deathPause = false;

// Bugs
let bugs = [];
let bugEscalation   = 0;  // 0 = initial, 1 = mid, 2 = late
let bugsCaught      = 0;  // bombs kills — scored in Feature 3
let bugsTotalSpawned = 0; // denominator for bug score

// Input
const keys = {};
let leaderboardExpanded = false;

// ── Init ───────────────────────────────────────────────
function initGame() {
  canvas = document.getElementById('game-canvas');
  ctx    = canvas.getContext('2d');

  canvas.width  = COLS * TILE;
  canvas.height = ROWS * TILE;

  scaleCanvas();
  window.addEventListener('resize', scaleCanvas);

  resetGame();
  bindInput();
  showScreen('game');
  requestAnimationFrame(gameLoop);
}

function scaleCanvas() {
  const SIDEBAR_W = leaderboardExpanded ? 280 : 0;
  const HUD_H     = 80;
  const PAD       = 40;

  const availW = window.innerWidth  - SIDEBAR_W - PAD;
  const availH = window.innerHeight - HUD_H     - PAD;

  const scaleX = availW / (COLS * TILE);
  const scaleY = availH / (ROWS * TILE);
  const scale  = Math.min(scaleX, scaleY, 1);

  canvas.style.width  = `${Math.floor(COLS * TILE * scale)}px`;
  canvas.style.height = `${Math.floor(ROWS * TILE * scale)}px`;
}

function toggleLeaderboard() {
  leaderboardExpanded = !leaderboardExpanded;
  const panel = document.querySelector('.leaderboard-panel');
  panel.classList.toggle('collapsed', !leaderboardExpanded);
  scaleCanvas();
}

function resetGame() {
  maze     = MAZE_TEMPLATE.map(r => [...r]);
  dots     = buildDots();
  totalDots = dots.filter(Boolean).length; // count truthy entries
  dotsEaten = 0;
  lives    = 3;
  totalLives = 3;
  timeLeft = 60;
  score    = 0;
  gameActive = true;
  gameOver   = false;
  deathPause = false;

  bugs             = [];
  bugEscalation    = 0;
  bugsCaught       = 0;
  bugsTotalSpawned = 0;
  spawnBugs(3);

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
  if (DEBUG) timeLeft = 10; // short timer for testing game over flow
  timerInterval = setInterval(() => {
    if (!gameActive || deathPause) return;
    timeLeft--;
    updateHUD();
    checkBugEscalation();
    if (timeLeft <= 0) endGame();
  }, DEBUG ? 300 : 1000); // 0.3s ticks in debug = ~3s total
}

// ── Input ──────────────────────────────────────────────
function bindInput() {
  document.addEventListener('keydown', e => {
    keys[e.key] = true;
    switch (e.key) {
      case 'ArrowUp':    case 'w': case 'W': player.nextDx=0;  player.nextDy=-SPEED; break;
      case 'ArrowDown':  case 's': case 'S': player.nextDx=0;  player.nextDy= SPEED; break;
      case 'ArrowLeft':  case 'a': case 'A': player.nextDx=-SPEED; player.nextDy=0; break;
      case 'ArrowRight': case 'd': case 'D': player.nextDx= SPEED; player.nextDy=0; break;
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

// Can a sprite of `size` occupy pixel rect starting at (px, py)?
function canMoveAt(px, py, size) {
  const margin = 3;
  const s = size - margin * 2;
  const ox = margin, oy = margin;
  return (
    tileAt(px + ox,       py + oy)       !== 1 &&
    tileAt(px + ox + s,   py + oy)       !== 1 &&
    tileAt(px + ox,       py + oy + s)   !== 1 &&
    tileAt(px + ox + s,   py + oy + s)   !== 1
  );
}

function canMove(px, py) { return canMoveAt(px, py, player.size); }

// Snap to nearest tile boundary (used for turns at junctions)
function snapToGrid(v) {
  return Math.round(v / TILE) * TILE;
}

// Direction-aware snap when stopping at a wall.
// Adds/subtracts the hitbox margin so we always land on the safe side.
function snapOnHit(v, dv) {
  const m = 3; // must match canMove margin
  if (dv > 0) return Math.floor((v + m) / TILE) * TILE; // moving positive → snap back
  if (dv < 0) return Math.ceil((v - m) / TILE) * TILE;  // moving negative → snap forward
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
  if (bugEscalation === 0 && timeLeft <= 40) {
    bugEscalation = 1;
    escalateBugs1();
  } else if (bugEscalation === 1 && timeLeft <= 20) {
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

// True when coordinate is within SPEED px of a tile boundary on either side
function nearBoundary(v) {
  const mod = ((v % TILE) + TILE) % TILE;
  return mod <= SPEED || mod >= (TILE - SPEED);
}

function movePlayer() {
  if (!gameActive || deathPause) return;

  const wantNew    = player.nextDx !== player.dx || player.nextDy !== player.dy;
  const stationary = player.dx === 0 && player.dy === 0;
  const reversal   = (player.nextDx === -player.dx && player.dx !== 0) ||
                     (player.nextDy === -player.dy && player.dy !== 0);
  const atBoundary = nearBoundary(player.x) && nearBoundary(player.y);

  if (wantNew && (stationary || reversal || atBoundary)) {
    const sx = reversal ? player.x : snapToGrid(player.x);
    const sy = reversal ? player.y : snapToGrid(player.y);
    if (reversal || canMove(sx + player.nextDx, sy + player.nextDy)) {
      player.x = sx; player.y = sy;
      player.dx = player.nextDx; player.dy = player.nextDy;
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
    score += 10;
    updateHUD();
    if (dotsEaten >= totalDots) endGame(); // all dots eaten
  }
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

// ── End Game ───────────────────────────────────────────
function endGame() {
  gameActive = false;
  clearInterval(timerInterval);

  const pathPct = Math.round((dotsEaten / totalDots) * 100);
  const bugPct  = bugsTotalSpawned > 0
    ? Math.round((bugsCaught / bugsTotalSpawned) * 100)
    : 0;
  const finalScore = Math.round(pathPct * 0.6 + bugPct * 0.4);

  document.getElementById('go-paths').textContent  = `${pathPct}%`;
  document.getElementById('go-bugs').textContent   = `${bugPct}%`;
  document.getElementById('go-final').textContent  = finalScore;

  cancelAnimationFrame(animFrame);
  showScreen('gameover');
}

// ── HUD ────────────────────────────────────────────────
function updateHUD() {
  const timerEl = document.getElementById('hud-timer');
  timerEl.textContent = timeLeft;
  timerEl.classList.toggle('warning', timeLeft <= 10 && timeLeft > 5);
  timerEl.classList.toggle('danger',  timeLeft <= 5);

  document.getElementById('hud-score').textContent = score;

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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMaze();
  drawDots();
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
  const cx = player.x + player.size / 2 + 3;
  const cy = player.y + player.size / 2 + 3;
  const r  = player.size / 2;

  // glow
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.8);
  grad.addColorStop(0, COLORS.playerGlow);
  grad.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // body
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.player;
  ctx.fill();

  // eyes (direction indicator)
  const eyeOffset = player.dx !== 0 ? { ex: player.dx > 0 ? 4 : -4, ey: -3 }
                  : player.dy !== 0 ? { ex: 3, ey: player.dy > 0 ? 3 : -4 }
                  : { ex: 3, ey: -3 };
  ctx.beginPath();
  ctx.arc(cx + eyeOffset.ex, cy + eyeOffset.ey, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.background;
  ctx.fill();
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

// ── Game Loop ──────────────────────────────────────────
function gameLoop() {
  moveBugs();
  movePlayer();
  checkBugCollisions();
  draw();
  animFrame = requestAnimationFrame(gameLoop);
}

// ── Screen management ──────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
}

// ── Registration form ──────────────────────────────────
document.getElementById('form-register').addEventListener('submit', e => {
  e.preventDefault();
  const name  = document.getElementById('input-name').value.trim();
  const email = document.getElementById('input-email').value.trim();
  const errEl = document.getElementById('form-error');

  if (!name) { showError(errEl, 'Please enter your name or nickname.'); return; }
  if (!isValidEmail(email)) { showError(errEl, 'Please enter a valid email address.'); return; }

  errEl.classList.add('hidden');
  // Store for later use (score submission etc.)
  window.playerName  = name;
  window.playerEmail = email;

  initGame();
});

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// ── Play Again ─────────────────────────────────────────
document.getElementById('btn-play-again').addEventListener('click', () => {
  cancelAnimationFrame(animFrame);
  clearInterval(timerInterval);
  resetGame();
  showScreen('game');
  animFrame = requestAnimationFrame(gameLoop);
});

document.getElementById('btn-leaderboard').addEventListener('click', () => {
  // placeholder — leaderboard feature added in Feature 6
});

document.getElementById('btn-limit-lb').addEventListener('click', () => {
  // placeholder
});
