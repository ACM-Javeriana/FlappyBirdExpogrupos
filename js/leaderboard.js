// Tabla de clasificación local (localStorage) con borrado protegido por contraseña.
// El workflow de GitHub Pages reemplaza el marcador por el SHA-256 de la contraseña.
const RESET_PASSWORD_HASH = '__RESET_PASSWORD_HASH__';
const LB_KEYS = { camera: 'flappy-leaderboard-camera', click: 'flappy-leaderboard-click' };
const MAX_ENTRIES = 10;

function load(kind) {
  try { return JSON.parse(localStorage.getItem(LB_KEYS[kind])) || []; } catch { return []; }
}
function save(kind, list) {
  try { localStorage.setItem(LB_KEYS[kind], JSON.stringify(list)); } catch { /* sin almacenamiento */ }
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// kind: 'camera' (solo aleteos) o 'click' (hubo al menos un clic/toque/tecla en la partida).
export function addScore(kind, name, score) {
  if (score <= 0) return;
  const list = load(kind);
  list.push({ name: name || 'Anónimo', score, t: Date.now() });
  list.sort((a, b) => b.score - a.score || a.t - b.t);
  save(kind, list.slice(0, MAX_ENTRIES));
}

export function renderLeaderboard(ol, kind) {
  const list = load(kind);
  ol.replaceChildren();
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Aún no hay puntajes';
    ol.append(li);
    return;
  }
  for (const e of list) {
    const li = document.createElement('li');
    const n = document.createElement('span');
    n.textContent = e.name;
    const p = document.createElement('b');
    p.textContent = e.score;
    li.append(n, p);
    ol.append(li);
  }
}

// Devuelve true si la contraseña era correcta y la tabla se borró.
export async function resetLeaderboard() {
  const pw = prompt('Contraseña para borrar las tablas:');
  if (pw === null) return false;
  if (await sha256Hex(pw) !== RESET_PASSWORD_HASH) {
    alert('Contraseña incorrecta');
    return false;
  }
  for (const kind of Object.keys(LB_KEYS)) save(kind, []);
  return true;
}
