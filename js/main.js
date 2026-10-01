import { loadSprites, Sound } from './assets.js';
import { Game, State } from './game.js';
import { addScore, renderLeaderboard, resetLeaderboard } from './leaderboard.js';

const $ = (id) => document.getElementById(id);
const sound = new Sound();
const sprites = await loadSprites();
const game = new Game($('game'), sprites, sound);

// Jugador y tabla de clasificación.
const nameInput = $('player-name');
try { nameInput.value = localStorage.getItem('flappy-player') || ''; } catch { /* sin almacenamiento */ }
const playerName = () => nameInput.value.trim() || 'Anónimo';
const startEl = $('start');
const overlayOpen = () => !startEl.classList.contains('hidden');
let cameraOn = false;
let manualMode = false;

// La partida cuenta como "sin cámara" si hubo algún salto por clic, toque o teclado.
let runManual = false;
let boardKind = 'camera';
function refreshBoard() { renderLeaderboard($('lb'), boardKind); }
function showBoard(kind) {
  boardKind = kind;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.kind === kind));
  refreshBoard();
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showBoard(t.dataset.kind)));
refreshBoard();
game.onGameOver = (score) => {
  const kind = runManual ? 'click' : 'camera';
  addScore(kind, playerName(), score);
  runManual = false;
  showBoard(kind);
  openMenu();
};
$('lb-reset').addEventListener('click', async () => { if (await resetLeaderboard()) refreshBoard(); });
function closeMenu() {
  startEl.classList.add('hidden');
  if (game.state === State.OVER) game.reset();   // deja el pájaro listo para la nueva partida
}
function openMenu() {
  refreshBoard();
  $('start-btn').textContent = cameraOn || manualMode ? 'Jugar de nuevo' : 'Activar cámara y jugar';
  startEl.classList.remove('hidden');
}
$('menu-btn').addEventListener('click', () => { openMenu(); nameInput.focus(); });

const flashEl = $('flash');
let flashTimer;
function flap(fromBody) {
  if (overlayOpen()) return;
  if (!fromBody && (game.state === State.READY || game.state === State.PLAYING)) runManual = true;
  sound.init();
  sound.unlock();
  game.flap();
  if (fromBody) {
    flashEl.classList.add('show');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => flashEl.classList.remove('show'), 120);
  }
}

// Controles de respaldo: teclado, clic y toque.
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (!e.repeat) flap(false);
  }
});
$('game').addEventListener('pointerdown', (e) => { e.preventDefault(); flap(false); });

const statusEl = $('status');
function setStatus(text, ok) {
  statusEl.textContent = text;
  statusEl.classList.toggle('ok', !!ok);
}

// Barra lateral: muestra la altura de los brazos (arriba = brazos arriba).
const fill = $('meter-fill');
function setMeter(arm) {
  if (arm === null) { fill.style.height = '0'; return; }
  const pct = Math.min(Math.max(50 - arm * 30, 0), 100);
  fill.style.height = `${pct}%`;
}

const sens = $('sensitivity');
// El control va de "poco sensible" a "muy sensible"; se invierte a amplitud requerida.
const amplitude = () => 1.4 - Number(sens.value);

$('noc-btn').addEventListener('click', () => {
  try { localStorage.setItem('flappy-player', nameInput.value.trim()); } catch { /* sin almacenamiento */ }
  manualMode = true;
  closeMenu();
  sound.init();
});

$('start-btn').addEventListener('click', async () => {
  try { localStorage.setItem('flappy-player', nameInput.value.trim()); } catch { /* sin almacenamiento */ }
  if (cameraOn || manualMode) { closeMenu(); return; }
  const btn = $('start-btn');
  btn.disabled = true;
  $('start-error').textContent = '';
  await sound.init();
  sound.unlock();
  try {
    const { PoseTracker } = await import('./pose.js');
    const tracker = new PoseTracker($('video'), $('overlay'), () => flap(true), setStatus, setMeter);
    tracker.setSensitivity(amplitude());
    sens.addEventListener('input', () => tracker.setSensitivity(amplitude()));
    $('start').classList.add('hidden');
    setStatus('Iniciando cámara…');
    await tracker.start();
    cameraOn = true;
    manualMode = false;
  } catch (e) {
    console.error(e);
    $('start').classList.remove('hidden');
    $('start-error').textContent = e.name === 'NotAllowedError'
      ? 'Permiso de cámara denegado. Puedes jugar con Espacio o clic.'
      : `No se pudo iniciar la cámara: ${e.message}`;
    btn.disabled = false;
  }
});
