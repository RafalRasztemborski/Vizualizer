import type { P5SketchModule } from '../core/types';

export const wallGridSketch: P5SketchModule = {
  id: 'wall-grid',
  name: 'Reactive Wall Grid',
  description: 'Grid modulowany basem, kickiem i wysokimi pasmami.',
  params: [
    { key: 'wallAmplitude', label: 'Wall amplitude', type: 'number', min: 0, max: 220, step: 1, defaultValue: 90 },
    { key: 'cellSize', label: 'Cell size', type: 'number', min: 12, max: 80, step: 1, defaultValue: 34 },
    { key: 'hue', label: 'Hue', type: 'number', min: 0, max: 360, step: 1, defaultValue: 184 },
    { key: 'rotation', label: 'Rotation', type: 'number', min: -1, max: 1, step: 0.01, defaultValue: 0.12 },
  ],
  setup(p) {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.noiseDetail(3, 0.45);
  },
  draw({ p, signals, params, routedParams, timeMs }) {
    const cellSize = Number(params.cellSize);
    const wallAmplitude = Number(params.wallAmplitude) + (routedParams.wallAmplitude ?? 0);
    const hue = Number(params.hue) + (routedParams.hue ?? 0);
    const rotation = Number(params.rotation) + (routedParams.rotation ?? 0);
    const t = timeMs * 0.00045;

    p.background(216, 18, 8, 1);
    p.push();
    p.translate(p.width / 2, p.height / 2);
    p.rotate(rotation * Math.sin(t) + signals.detectedKick * 0.2);
    p.translate(-p.width / 2, -p.height / 2);
    p.noStroke();

    for (let y = -cellSize; y < p.height + cellSize; y += cellSize) {
      for (let x = -cellSize; x < p.width + cellSize; x += cellSize) {
        const n = p.noise(x * 0.009, y * 0.009, t);
        const bassLift = signals.bass * wallAmplitude;
        const kickLift = signals.kickEnergy * wallAmplitude * 1.8;
        const size = cellSize * (0.22 + n * 0.62) + bassLift + kickLift;
        const brightness = 22 + signals.mid * 46 + n * 32;
        p.fill((hue + n * 80 + signals.high * 70) % 360, 74, brightness, 0.9);
        p.rect(x + cellSize / 2 - size / 2, y + cellSize / 2 - size / 2, size, size, 3);
      }
    }

    p.pop();
  },
  windowResized(p) {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  },
};
