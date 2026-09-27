import { loadSprites, Sound } from './assets.js';
import { Game } from './game.js';

const $ = (id) => document.getElementById(id);
const sound = new Sound();
const sprites = await loadSprites();
const game = new Game($('game'), sprites, sound);

const flashEl = $('flash');
let flashTimer;
function flap(fromBody) {
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

$('start-btn').addEventListener('click', async () => {
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
  } catch (e) {
    console.error(e);
    $('start').classList.remove('hidden');
    $('start-error').textContent = e.name === 'NotAllowedError'
      ? 'Permiso de cámara denegado. Puedes jugar con Espacio o clic.'
      : `No se pudo iniciar la cámara: ${e.message}`;
    btn.disabled = false;
  }
});
