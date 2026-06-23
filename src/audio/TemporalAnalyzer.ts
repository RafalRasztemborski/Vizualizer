import { lerp, clamp } from './dspUtils';

export interface TemporalConfig {
  historyMs?: number; // how much history to keep in ms
  fps?: number; // expected processing frames per second
  smoothing?: 'gaussian' | 'ema';
  emaAlpha?: number; // for ema smoothing
  lookAheadFrames?: number; // how many frames to predict ahead
  onsetThreshold?: number; // optional minimum onset amplitude
  bpm?: number | null; // if provided, compute beatPhase
}

export interface TemporalOutput {
  bands: Float32Array;
  smoothedBands: Float32Array;
  predictedBands: Float32Array;

  energy: number;
  smoothedEnergy: number;
  predictedEnergy: number;

  centroid: number;
  smoothedCentroid: number;

  flux: number;
  smoothedFlux: number;

  peaks: boolean[];
  onset: number;
  beatPhase: number | null;
}

export class TemporalAnalyzer {
  historyMs: number;
  fps: number;
  maxFrames: number;
  smoothing: 'gaussian' | 'ema';
  emaAlpha: number;
  lookAheadFrames: number;
  onsetThreshold: number;
  bpm: number | null;

  // circular buffer
  bandsBuffer: Float32Array[] = [];
  featuresBuffer: any[] = [];

  // cached smoothed values
  prevSmoothedEnergy = 0;
  prevSmoothedBands: Float32Array | null = null;
  prevTime = 0;

  constructor(cfg: TemporalConfig = {}) {
    this.historyMs = cfg.historyMs ?? 400;
    this.fps = cfg.fps ?? 60;
    this.maxFrames = Math.max(3, Math.ceil((this.historyMs / 1000) * this.fps));
    this.smoothing = cfg.smoothing ?? 'gaussian';
    this.emaAlpha = cfg.emaAlpha ?? 0.3;
    this.lookAheadFrames = cfg.lookAheadFrames ?? 4;
    this.onsetThreshold = cfg.onsetThreshold ?? 0.001;
    this.bpm = cfg.bpm ?? null;
  }

  push(bands: Float32Array, features: any, timestampMs?: number) {
    // push copies
    this.bandsBuffer.push(bands.slice(0));
    this.featuresBuffer.push({ ...features });
    if (this.bandsBuffer.length > this.maxFrames) {
      this.bandsBuffer.shift();
      this.featuresBuffer.shift();
    }
    this.prevTime = timestampMs ?? Date.now();
  }

  // gaussian kernel centered on last frame over window size (odd)
  private gaussianKernel(radius: number) {
    const size = radius * 2 + 1;
    const sigma = radius / 2 || 1;
    const kernel = new Float32Array(size);
    let sum = 0;
    for (let i = 0; i < size; i++) {
      const x = i - radius;
      kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
      sum += kernel[i];
    }
    for (let i = 0; i < size; i++) kernel[i] /= sum;
    return kernel;
  }

  private smoothBandsGaussian(): Float32Array {
    const radius = 3; // +-3 frames
    const kernel = this.gaussianKernel(radius);
    const bandsCount = this.bandsBuffer[0].length;
    const out = new Float32Array(bandsCount);
    const lastIndex = this.bandsBuffer.length - 1;
    for (let k = 0; k < kernel.length; k++) {
      const idx = lastIndex - (kernel.length - 1 - k);
      const frame = this.bandsBuffer[idx] ?? this.bandsBuffer[0];
      for (let b = 0; b < bandsCount; b++) out[b] += frame[b] * kernel[k];
    }
    return out;
  }

  private smoothScalarGaussian(values: number[]): number {
    const radius = 3;
    const kernel = this.gaussianKernel(radius);
    const lastIndex = values.length - 1;
    let out = 0;
    for (let k = 0; k < kernel.length; k++) {
      const idx = lastIndex - (kernel.length - 1 - k);
      const v = values[idx] ?? values[0];
      out += v * kernel[k];
    }
    return out;
  }

  private smoothEMA(prev: number, current: number) {
    return prev * (1 - this.emaAlpha) + current * this.emaAlpha;
  }

  update(): TemporalOutput {
    if (this.bandsBuffer.length === 0) throw new Error('No frames in buffer');

    const curBands = this.bandsBuffer[this.bandsBuffer.length - 1];
    const curFeatures = this.featuresBuffer[this.featuresBuffer.length - 1];

    // compute smoothed bands
    let smoothedBands: Float32Array;
    if (this.smoothing === 'gaussian' && this.bandsBuffer.length >= 1) {
      smoothedBands = this.smoothBandsGaussian();
    } else {
      // EMA across last frame only
      const prev = this.prevSmoothedBands ?? curBands;
      smoothedBands = new Float32Array(curBands.length);
      for (let i = 0; i < curBands.length; i++)
        smoothedBands[i] = this.smoothEMA(prev[i] ?? 0, curBands[i]);
    }

    // energy smoothing
    const energyHistory = this.featuresBuffer.map((f) => f.energy as number);
    const smoothedEnergy =
      this.smoothing === 'gaussian'
        ? this.smoothScalarGaussian(energyHistory)
        : this.smoothEMA(this.prevSmoothedEnergy, curFeatures.energy);

    // centroid smoothing
    const centroidHistory = this.featuresBuffer.map(
      (f) => f.centroid as number,
    );
    const smoothedCentroid =
      this.smoothing === 'gaussian'
        ? this.smoothScalarGaussian(centroidHistory)
        : this.smoothEMA(0, curFeatures.centroid);

    // flux smoothing
    const fluxHistory = this.featuresBuffer.map((f) => f.flux as number);
    const smoothedFlux =
      this.smoothing === 'gaussian'
        ? this.smoothScalarGaussian(fluxHistory)
        : this.smoothEMA(0, curFeatures.flux);

    // velocity = current - previous (element-wise)
    const prevBands =
      this.bandsBuffer.length >= 2
        ? this.bandsBuffer[this.bandsBuffer.length - 2]
        : curBands;
    const velocity = new Float32Array(curBands.length);
    for (let i = 0; i < curBands.length; i++)
      velocity[i] = curBands[i] - (prevBands[i] ?? 0);

    const energyVelocity =
      curFeatures.energy -
      (this.featuresBuffer.length >= 2
        ? this.featuresBuffer[this.featuresBuffer.length - 2].energy
        : curFeatures.energy);

    // predicted = smoothed + velocity * lookAheadFrames
    const predictedBands = new Float32Array(curBands.length);
    for (let i = 0; i < curBands.length; i++)
      predictedBands[i] = smoothedBands[i] + velocity[i] * this.lookAheadFrames;

    const predictedEnergy =
      smoothedEnergy + energyVelocity * this.lookAheadFrames;

    // onset detection
    const onset = Math.max(0, smoothedEnergy - this.prevSmoothedEnergy);
    const onsetFinal = onset > this.onsetThreshold ? onset : 0;

    // beat phase
    let beatPhase: number | null = null;
    if (this.bpm) {
      const beatDurationMs = (60 * 1000) / this.bpm;
      beatPhase =
        ((this.prevTime ?? Date.now()) % beatDurationMs) / beatDurationMs;
    }

    // peaks from latest features
    const peaks = curFeatures.peaks as boolean[];

    // cache
    this.prevSmoothedEnergy = smoothedEnergy;
    this.prevSmoothedBands = smoothedBands.slice(0);

    return {
      bands: curBands.slice(0),
      smoothedBands,
      predictedBands,

      energy: curFeatures.energy,
      smoothedEnergy,
      predictedEnergy,

      centroid: curFeatures.centroid,
      smoothedCentroid,

      flux: curFeatures.flux,
      smoothedFlux,

      peaks,
      onset: onsetFinal,
      beatPhase,
    };
  }
}

export default TemporalAnalyzer;
