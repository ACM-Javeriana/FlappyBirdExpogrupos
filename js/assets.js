const SPRITES = [
  'background-day', 'base', 'pipe-green', 'message', 'gameover',
  'yellowbird-upflap', 'yellowbird-midflap', 'yellowbird-downflap',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
];
const SOUNDS = ['wing', 'point', 'hit', 'die', 'swoosh'];

function loadImage(name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${name}.png`));
    img.src = `assets/sprites/${name}.png`;
  });
}

export async function loadSprites() {
  const imgs = await Promise.all(SPRITES.map(loadImage));
  return Object.fromEntries(SPRITES.map((n, i) => [n, imgs[i]]));
}

// Web Audio para baja latencia; se desbloquea con el primer gesto del usuario.
export class Sound {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    const probe = document.createElement('audio');
    this.ext = probe.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'wav';
  }

  async init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    await Promise.all(SOUNDS.map(async (name) => {
      try {
        const res = await fetch(`assets/audio/${name}.${this.ext}`);
        const data = await res.arrayBuffer();
        this.buffers[name] = await this.ctx.decodeAudioData(data);
      } catch (e) {
        console.warn('Audio no disponible:', name, e);
      }
    }));
  }

  unlock() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  play(name) {
    const buf = this.buffers[name];
    if (!this.ctx || !buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start();
  }
}
