// Réplica de Flappy Bird a 288x512 (tamaño de los sprites originales).
// Constantes tomadas del clon fiel FlapPyBird (30 fps) convertidas a 60 fps.
const W = 288;
const H = 512;
const BASE_Y = Math.floor(H * 0.79);   // 404
const PIPE_GAP = 100;
const PIPE_W = 52;
const PIPE_H = 320;
const PIPE_SPACING = W / 2;            // 144 px entre tubos
const SCROLL = 2;                      // px por frame (60 fps)
const GRAVITY = 0.25;
const FLAP_VEL = -4.5;
const MAX_FALL = 5;
const ROT_THRESHOLD = 20;
const ROT_SPEED = 1.5;
const BIRD_X = Math.floor(W * 0.2);
const BIRD_W = 34;
const BIRD_H = 24;
const FLAP_FRAMES = [0, 1, 2, 1];      // up, mid, down, mid
const STEP = 1000 / 60;

const State = { READY: 0, PLAYING: 1, DYING: 2, OVER: 3 };

export class Game {
  constructor(canvas, sprites, sound) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.s = sprites;
    this.sound = sound;
    this.birdFrames = [sprites['yellowbird-upflap'], sprites['yellowbird-midflap'], sprites['yellowbird-downflap']];
    try { this.best = Number(localStorage.getItem('flappy-best')) || 0; } catch { this.best = 0; }
    this.baseX = 0;
    this.reset();
    this.last = performance.now();
    this.acc = 0;
    requestAnimationFrame((t) => this.loop(t));
  }

  reset() {
    this.state = State.READY;
    this.frame = 0;
    this.score = 0;
    this.bird = { y: (H - BIRD_H) / 2, vy: 0, rot: 0, anim: 0 };
    this.pipes = [];
    this.flash = 0;
    this.overAt = 0;
    this.overAnim = 0;
  }

  flap() {
    const now = performance.now();
    switch (this.state) {
      case State.READY:
        this.state = State.PLAYING;
        this.pipes = [this.newPipe(W + 100), this.newPipe(W + 100 + PIPE_SPACING)];
        this.doFlap();
        break;
      case State.PLAYING:
        if (this.bird.y > -2 * BIRD_H) this.doFlap();
        break;
      case State.OVER:
        if (now - this.overAt > 600) {
          this.sound.play('swoosh');
          this.reset();
        }
        break;
    }
  }

  doFlap() {
    this.bird.vy = FLAP_VEL;
    this.bird.rot = 45;
    this.sound.play('wing');
  }

  newPipe(x) {
    const range = Math.floor(BASE_Y * 0.6 - PIPE_GAP);
    const gapY = Math.floor(Math.random() * range) + Math.floor(BASE_Y * 0.2);
    return { x, gapY, passed: false };
  }

  loop(t) {
    this.acc += Math.min(t - this.last, 250);
    this.last = t;
    while (this.acc >= STEP) {
      this.update();
      this.acc -= STEP;
    }
    this.draw();
    requestAnimationFrame((tt) => this.loop(tt));
  }

  update() {
    this.frame++;
    const b = this.bird;
    const scrolling = this.state === State.READY || this.state === State.PLAYING;

    if (scrolling) {
      this.baseX = (this.baseX - SCROLL) % (this.s.base.width - W);
      if (this.frame % 5 === 0) b.anim = (b.anim + 1) % FLAP_FRAMES.length;
    }

    if (this.state === State.READY) {
      // Oscilación suave (simple harmonic motion) como en el menú original.
      b.y = (H - BIRD_H) / 2 + Math.sin(this.frame / 9) * 4;
      return;
    }

    if (this.state === State.PLAYING || this.state === State.DYING) {
      if (this.state === State.DYING) {
        // Tras chocar con un tubo cae en picado hasta el suelo.
        b.vy = Math.min(b.vy + GRAVITY * 2, MAX_FALL * 2);
        b.rot = Math.max(b.rot - ROT_SPEED * 4, -90);
      } else {
        b.vy = Math.min(b.vy + GRAVITY, MAX_FALL);
        b.rot = Math.max(b.rot - ROT_SPEED, -90);
      }
      b.y += b.vy;
      if (b.y + BIRD_H >= BASE_Y) {
        b.y = BASE_Y - BIRD_H;
        if (this.state === State.PLAYING) this.hit(false);
        this.state = State.OVER;
        this.overAt = performance.now();
        this.saveBest();
      }
    }

    if (this.state === State.PLAYING) {
      for (const p of this.pipes) p.x -= SCROLL;
      const first = this.pipes[0];
      if (first && first.x < -PIPE_W) this.pipes.shift();
      const lastPipe = this.pipes[this.pipes.length - 1];
      if (lastPipe && lastPipe.x <= W + 100 - PIPE_SPACING) {
        this.pipes.push(this.newPipe(lastPipe.x + PIPE_SPACING));
      }

      const mid = BIRD_X + BIRD_W / 2;
      for (const p of this.pipes) {
        if (!p.passed && p.x + PIPE_W / 2 <= mid) {
          p.passed = true;
          this.score++;
          this.sound.play('point');
        }
      }
      if (this.collides()) this.hit(true);
    }

    if (this.flash > 0) this.flash--;
    if (this.state === State.OVER) this.overAnim = Math.min(this.overAnim + 1, 60);
  }

  collides() {
    // Caja del pájaro ligeramente reducida para aproximar la máscara por píxel.
    const m = 3;
    const bx1 = BIRD_X + m, bx2 = BIRD_X + BIRD_W - m;
    const by1 = this.bird.y + m, by2 = this.bird.y + BIRD_H - m;
    for (const p of this.pipes) {
      if (bx2 > p.x && bx1 < p.x + PIPE_W) {
        if (by1 < p.gapY || by2 > p.gapY + PIPE_GAP) return true;
      }
    }
    return false;
  }

  hit(fall) {
    this.sound.play('hit');
    this.flash = 6;
    if (fall) {
      this.state = State.DYING;
      this.bird.vy = 0;
      setTimeout(() => this.sound.play('die'), 250);
    }
  }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      try { localStorage.setItem('flappy-best', String(this.best)); } catch { /* sin almacenamiento */ }
    } else {
      this.newBest = false;
    }
  }

  draw() {
    const c = this.ctx;
    const s = this.s;
    c.drawImage(s['background-day'], 0, 0);

    const pipe = s['pipe-green'];
    for (const p of this.pipes) {
      const x = Math.round(p.x);
      // Tubo superior: el mismo sprite volteado verticalmente.
      c.save();
      c.translate(x, p.gapY);
      c.scale(1, -1);
      c.drawImage(pipe, 0, 0);
      c.restore();
      c.drawImage(pipe, x, p.gapY + PIPE_GAP);
    }

    c.drawImage(s.base, Math.round(this.baseX), BASE_Y);

    this.drawBird();

    if (this.state === State.READY) {
      c.drawImage(s.message, Math.floor((W - s.message.width) / 2), Math.floor(H * 0.12));
    }
    if (this.state === State.PLAYING || this.state === State.DYING) {
      this.drawNumber(this.score, W / 2, Math.floor(H * 0.1), 1);
    }
    if (this.state === State.OVER) this.drawGameOver();

    if (this.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${this.flash / 6})`;
      c.fillRect(0, 0, W, H);
    }
  }

  drawBird() {
    const c = this.ctx;
    const b = this.bird;
    const frame = this.birdFrames[FLAP_FRAMES[b.anim]];
    const rot = this.state === State.READY ? 0 : Math.min(b.rot, ROT_THRESHOLD);
    c.save();
    c.translate(BIRD_X + BIRD_W / 2, Math.round(b.y) + BIRD_H / 2);
    c.rotate((-rot * Math.PI) / 180);
    c.drawImage(frame, -BIRD_W / 2, -BIRD_H / 2);
    c.restore();
  }

  drawNumber(n, cx, y, scale) {
    const digits = String(n).split('').map((d) => this.s[d]);
    const total = digits.reduce((w, img) => w + img.width * scale, 0);
    let x = Math.round(cx - total / 2);
    for (const img of digits) {
      this.ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      x += img.width * scale;
    }
  }

  drawGameOver() {
    const c = this.ctx;
    const t = Math.min(this.overAnim / 20, 1);
    const go = this.s.gameover;
    c.globalAlpha = t;
    c.drawImage(go, Math.floor((W - go.width) / 2), Math.floor(H * 0.2) - Math.round((1 - t) * 10));
    c.globalAlpha = 1;

    // Tablero de puntuación estilo original, que sube desde abajo.
    const p = Math.min(Math.max((this.overAnim - 15) / 25, 0), 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const pw = 226, ph = 114;
    const px = Math.floor((W - pw) / 2);
    const py = Math.round(H * 0.34 + (1 - ease) * (H - H * 0.34));
    c.fillStyle = '#543847';
    c.fillRect(px - 2, py - 2, pw + 4, ph + 4);
    c.fillStyle = '#ded895';
    c.fillRect(px, py, pw, ph);
    c.fillStyle = '#d0c874';
    c.fillRect(px + 4, py + ph - 6, pw - 8, 2);

    c.font = 'bold 12px "Courier New", monospace';
    c.fillStyle = '#e86101';
    c.textAlign = 'right';
    c.fillText('SCORE', px + pw - 14, py + 20);
    c.fillText('BEST', px + pw - 14, py + 66);
    c.textAlign = 'left';
    c.fillText('MEDAL', px + 20, py + 20);

    const scale = 0.6;
    this.drawNumberRight(this.score, px + pw - 14, py + 26, scale);
    this.drawNumberRight(this.best, px + pw - 14, py + 72, scale);
    if (this.newBest && this.score > 0) {
      c.fillStyle = '#e8401a';
      c.fillRect(px + pw - 94, py + 56, 30, 14);
      c.fillStyle = '#fff';
      c.font = 'bold 10px "Courier New", monospace';
      c.fillText('NEW', px + pw - 89, py + 67);
    }
    this.drawMedal(px + 49, py + 64);

    if (this.overAnim >= 60 && performance.now() - this.overAt > 600) {
      c.globalAlpha = 0.6 + 0.4 * Math.sin(this.frame / 10);
      c.font = 'bold 14px "Courier New", monospace';
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.strokeStyle = '#543847';
      c.lineWidth = 3;
      c.strokeText('¡Aletea para reiniciar!', W / 2, py + ph + 34);
      c.fillText('¡Aletea para reiniciar!', W / 2, py + ph + 34);
      c.globalAlpha = 1;
      c.textAlign = 'left';
    }
  }

  drawNumberRight(n, right, y, scale) {
    const digits = String(n).split('').map((d) => this.s[d]);
    let x = right;
    for (let i = digits.length - 1; i >= 0; i--) {
      const img = digits[i];
      x -= img.width * scale;
      this.ctx.drawImage(img, Math.round(x), y, img.width * scale, img.height * scale);
    }
  }

  drawMedal(cx, cy) {
    // Medallas del original: bronce 10, plata 20, oro 30, platino 40.
    const c = this.ctx;
    const tiers = [[40, '#e5e4e2', '#b9b8b5'], [30, '#f5c542', '#c99a1e'], [20, '#d7d7d7', '#a8a8a8'], [10, '#d88a3e', '#a0612a']];
    const tier = tiers.find(([min]) => this.score >= min);
    c.beginPath();
    c.arc(cx, cy, 22, 0, Math.PI * 2);
    if (!tier) {
      c.fillStyle = '#d0c874';
      c.fill();
      return;
    }
    c.fillStyle = tier[2];
    c.fill();
    c.beginPath();
    c.arc(cx, cy, 18, 0, Math.PI * 2);
    c.fillStyle = tier[1];
    c.fill();
  }
}
