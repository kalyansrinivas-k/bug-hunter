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
  const col = Math.floor(px / TILE);
  const row = Math.floor(py / TILE);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return 1;
  return maze[row][col];
}

// Can the player occupy pixel rect (px,py,size,size)?
function canMove(px, py) {
  const margin = 3; // small padding so player feels tight but fair
  const s = player.size - margin * 2;
  const ox = margin, oy = margin;
  return (
    tileAt(px + ox,       py + oy)       !== 1 &&
    tileAt(px + ox + s,   py + oy)       !== 1 &&
    tileAt(px + ox,       py + oy + s)   !== 1 &&
    tileAt(px + ox + s,   py + oy + s)   !== 1
  );
}

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
  const bugPct  = 0; // bugs not in Feature 1
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

// ── Game Loop ──────────────────────────────────────────
function gameLoop() {
  movePlayer();
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
