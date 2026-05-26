import type { P5SketchModule } from '../core/types';

type Particle = {
  angle: number;
  radius: number;
  speed: number;
  size: number;
};

const particles: Particle[] = [];

export const particleTunnelSketch: P5SketchModule = {
  id: 'particle-tunnel',
  name: 'Particle Tunnel',
  description: 'Tunel czastek sterowany pasmami i MIDI.',
  params: [
    { key: 'particleSpeed', label: 'Particle speed', type: 'number', min: 0.2, max: 12, step: 0.1, defaultValue: 4 },
    { key: 'spread', label: 'Spread', type: 'number', min: 0.4, max: 3, step: 0.01, defaultValue: 1.25 },
    { key: 'hue', label: 'Hue', type: 'number', min: 0, max: 360, step: 1, defaultValue: 310 },
    { key: 'trail', label: 'Trail', type: 'number', min: 0, max: 0.35, step: 0.01, defaultValue: 0.12 },
  ],
  setup(p) {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    particles.length = 0;

    for (let i = 0; i < 420; i += 1) {
      particles.push({
        angle: p.random(p.TWO_PI),
        radius: p.random(10, Math.max(p.width, p.height) * 0.7),
        speed: p.random(0.35, 1.8),
        size: p.random(1.5, 5),
      });
    }
  },
  draw({ p, signals, params, routedParams, midi, deltaMs }) {
    const speed = Number(params.particleSpeed) + (routedParams.particleSpeed ?? 0);
    const spread = Number(params.spread) + (routedParams.spread ?? 0);
    const hue = Number(params.hue) + (routedParams.hue ?? 0);
    const trail = Number(params.trail);
    const cc74 = midi.cc74 ?? 0;
    const dt = Math.min(2, deltaMs / 16.67);

    p.noStroke();
    p.fill(222, 18, 5, 1 - trail);
    p.rect(0, 0, p.width, p.height);
    p.translate(p.width / 2, p.height / 2);

    for (const particle of particles) {
      particle.radius += (particle.speed * speed + signals.bass * 18 + signals.detectedKick * 42) * dt;
      particle.angle += (0.001 + signals.high * 0.012 + cc74 * 0.006) * dt;

      const maxRadius = Math.max(p.width, p.height) * spread;
      if (particle.radius > maxRadius) {
        particle.radius = 8;
        particle.angle = p.random(p.TWO_PI);
      }

      const depth = particle.radius / maxRadius;
      const x = Math.cos(particle.angle) * particle.radius;
      const y = Math.sin(particle.angle) * particle.radius * 0.72;
      const size = particle.size + depth * 10 + signals.kickEnergy * 32;
      p.fill((hue + depth * 120 + signals.mid * 80) % 360, 82, 45 + depth * 50, 0.92);
      p.circle(x, y, size);
    }
  },
  windowResized(p) {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  },
};
