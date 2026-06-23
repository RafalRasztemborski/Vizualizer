import {
  FFTAnalyzer,
  BandAnalyzer,
  FeatureExtractor,
  TemporalAnalyzer,
  lerp,
} from './index';

// Example wiring of the pipeline. This shows how to feed PCM frames
// into the analyzers and obtain animation-friendly outputs.

const sampleRate = 44100;
const fftSize = 1024;

const fft = new FFTAnalyzer({ size: fftSize, sampleRate });
const band = new BandAnalyzer({ sampleRate });
band.setFFTSize(fftSize);
const feat = new FeatureExtractor();
const temporal = new TemporalAnalyzer({
  historyMs: 400,
  fps: 60,
  smoothing: 'gaussian',
  lookAheadFrames: 4,
});

// This function represents the per-frame update where you supply `fftSize` samples
export function processFrame(samples: Float32Array) {
  // 1) FFT -> magnitudes
  const mags = fft.computeMagnitudes(samples);

  // 2) Bands
  const bands = band.computeBandEnergies(mags);

  // 3) Features
  const features = feat.computeFeatures(mags, bands, sampleRate);

  // 4) Temporal Analyzer
  temporal.push(bands, features);
  const state = temporal.update();

  // 5) Animation mapping examples (do not implement rendering here)
  const alpha = 0.5; // interpolation between smoothed and predicted

  // Bass controls scale
  const bass = lerp(state.smoothedBands[0], state.predictedBands[0], alpha);
  // Mid controls rotation amount
  const mid = lerp(state.smoothedBands[3], state.predictedBands[3], alpha);
  // High controls particle emission intensity
  const high = lerp(state.smoothedBands[5], state.predictedBands[5], alpha);
  // Flux controls glitch intensity
  const flux = lerp(state.smoothedFlux, state.flux, alpha);
  // Centroid maps to color hue
  const hue = clamp01((state.smoothedCentroid - 200) / 5000);
  // Onset triggers events
  const triggered = state.onset > 0;

  return {
    raw: state,
    mapping: { bass, mid, high, flux, hue, triggered },
  };
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

// Example usage (pseudo):
// const samples = getNextAudioBlock(); // Float32Array length fftSize
// const out = processFrame(samples);
