# Flappy Bird · Aletea con los brazos

Flappy Bird controlado con el cuerpo: la cámara detecta tu pose y cada vez que **aleteas con los brazos** el pájaro salta.

- **Izquierda:** cámara con el esqueleto detectado y un indicador de la altura de los brazos.
- **Derecha:** Flappy Bird con los sprites y sonidos originales.

Todo corre en el navegador: no hay backend ni build.

## Cómo jugar

1. Pulsa **"Activar cámara y jugar"** y acepta el permiso de cámara.
2. Colócate de forma que se vean tus hombros y brazos.
3. Sube los brazos y bájalos con fuerza para aletear.
4. Si los aleteos no se detectan, sube la **sensibilidad**. Si el pájaro salta solo, bájala.

También puedes jugar con **Espacio**, **flecha arriba** o **clic/toque** sobre el juego.

## Ejecutar en local

```bash
python3 -m http.server 8000
```

Abre <http://localhost:8000>. La cámara necesita `localhost` o HTTPS.

## Desplegar en Vercel

Importa el repositorio en Vercel con:

- **Framework:** Other
- **Build command:** ninguno
- **Output directory:** la raíz (`.`)

## Estructura

```
index.html        Layout de pantalla dividida
style.css         Estilos
js/main.js        Arranque y conexión cámara ↔ juego
js/pose.js        Detección de pose (MediaPipe) y detector de aleteo
js/game.js        Lógica y dibujo de Flappy Bird
js/assets.js      Carga de sprites y sonidos
assets/           Sprites, audio y modelo de pose
vercel.json       Cabeceras de caché
```

## Ajustes rápidos (`js/game.js`)

| Constante      | Valor | Efecto                                |
| -------------- | ----- | ------------------------------------- |
| `PIPE_SPACING` | 150   | Distancia horizontal entre tubos      |
| `PIPE_GAP`     | 130   | Altura del hueco para pasar           |
| `GRAVITY`      | 0.25  | Gravedad                              |
| `FLAP_VEL`     | -4.5  | Fuerza del salto                      |

## Tecnologías

- [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker) con el modelo de pose *lite*
- JavaScript puro con Canvas 2D y Web Audio
- Sprites y sonidos de [samuelcust/flappy-bird-assets](https://github.com/samuelcust/flappy-bird-assets). Flappy Bird es propiedad de .GEARS Studios; este proyecto es solo para fines educativos y de demostración.
