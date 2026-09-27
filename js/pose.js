import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL = 'assets/models/pose_landmarker_lite.task';

const L_SHOULDER = 11, R_SHOULDER = 12, L_ELBOW = 13, R_ELBOW = 14, L_WRIST = 15, R_WRIST = 16;
const ARM_BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]];
const MIN_VIS = 0.5;
const COOLDOWN_MS = 180;

async function createLandmarker(delegate) {
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
}

/**
 * Detecta aleteos: altura media de las muñecas respecto a los hombros, normalizada
 * por el ancho de hombros. Un aleteo = subir los brazos y luego bajarlos con fuerza.
 * Se usa histéresis (amplitud mínima = sensibilidad) para contar un solo salto por bajada.
 */
export class FlapDetector {
  constructor() {
    this.amplitude = 0.5;
    this.reset();
  }

  reset() {
    this.smooth = null;
    this.armed = false;   // true = los brazos han subido y esperamos la bajada
    this.peak = -Infinity; // punto más bajo desde el último aleteo
    this.valley = Infinity; // punto más alto desde que se armó
    this.lastFlap = 0;
  }

  // arm: valor positivo = muñecas por debajo de los hombros.
  update(arm, now) {
    this.smooth = this.smooth === null ? arm : this.smooth * 0.4 + arm * 0.6;
    const v = this.smooth;
    if (!this.armed) {
      this.peak = Math.max(this.peak, v);
      if (v < this.peak - this.amplitude) {
        this.armed = true;
        this.valley = v;
      }
      return false;
    }
    this.valley = Math.min(this.valley, v);
    if (v > this.valley + this.amplitude && now - this.lastFlap > COOLDOWN_MS) {
      this.armed = false;
      this.peak = v;
      this.lastFlap = now;
      return true;
    }
    return false;
  }
}

export class PoseTracker {
  constructor(video, canvas, onFlap, onStatus, onMeter) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.draw = new DrawingUtils(this.ctx);
    this.onFlap = onFlap;
    this.onStatus = onStatus;
    this.onMeter = onMeter;
    this.detector = new FlapDetector();
    this.lastTime = -1;
  }

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();
    this.onStatus('Cargando modelo de pose…');
    try {
      this.landmarker = await createLandmarker('GPU');
    } catch (e) {
      console.warn('GPU no disponible, usando CPU', e);
      this.landmarker = await createLandmarker('CPU');
    }
    this.onStatus('Buscando persona…');
    requestAnimationFrame(() => this.loop());
  }

  setSensitivity(amplitude) {
    this.detector.amplitude = amplitude;
  }

  loop() {
    const v = this.video;
    if (v.readyState >= 2 && v.currentTime !== this.lastTime) {
      this.lastTime = v.currentTime;
      if (this.canvas.width !== v.videoWidth) {
        this.canvas.width = v.videoWidth;
        this.canvas.height = v.videoHeight;
      }
      const now = performance.now();
      const result = this.landmarker.detectForVideo(v, now);
      this.process(result.landmarks[0], now);
    }
    requestAnimationFrame(() => this.loop());
  }

  process(lm, now) {
    const c = this.ctx;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!lm) {
      this.detector.reset();
      this.onStatus('Colócate frente a la cámara', false);
      this.onMeter(null);
      return;
    }

    this.draw.drawConnectors(lm, ARM_BONES.map(([start, end]) => ({ start, end })), { color: '#f8c83c', lineWidth: 5 });
    this.draw.drawLandmarks([L_SHOULDER, R_SHOULDER, L_ELBOW, R_ELBOW, L_WRIST, R_WRIST].map((i) => lm[i]),
      { color: '#ffffff', fillColor: '#e86101', radius: 6 });

    const ls = lm[L_SHOULDER], rs = lm[R_SHOULDER];
    if (ls.visibility < MIN_VIS || rs.visibility < MIN_VIS) {
      this.detector.reset();
      this.onStatus('No veo tus hombros', false);
      this.onMeter(null);
      return;
    }
    // Si la muñeca no se ve, usa el codo como aproximación.
    const hand = (w, e) => (lm[w].visibility >= MIN_VIS ? lm[w] : lm[e].visibility >= MIN_VIS ? lm[e] : null);
    const lh = hand(L_WRIST, L_ELBOW), rh = hand(R_WRIST, R_ELBOW);
    if (!lh || !rh) {
      this.detector.reset();
      this.onStatus('Muestra ambos brazos', false);
      this.onMeter(null);
      return;
    }

    const shoulderW = Math.max(Math.hypot(ls.x - rs.x, ls.y - rs.y), 0.05);
    const arm = ((lh.y - ls.y) + (rh.y - rs.y)) / 2 / shoulderW;
    this.onStatus('¡Listo! Aletea para volar', true);
    this.onMeter(arm);
    if (this.detector.update(arm, now)) this.onFlap();
  }
}
