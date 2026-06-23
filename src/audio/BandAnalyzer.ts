import type FFTAnalyzer from './FFTAnalyzer';

export interface BandDef {
  name: string;
  lo: number;
  hi: number;
}

export interface BandAnalyzerConfig {
  bands?: BandDef[];
  sampleRate?: number;
}

export const DEFAULT_BANDS: BandDef[] = [
  { name: 'subBass', lo: 20, hi: 60 },
  { name: 'bass', lo: 60, hi: 250 },
  { name: 'lowMid', lo: 250, hi: 500 },
  { name: 'mid', lo: 500, hi: 2000 },
  { name: 'highMid', lo: 2000, hi: 6000 },
  { name: 'high', lo: 6000, hi: 20000 },
];

export class BandAnalyzer {
  bands: BandDef[];
  sampleRate: number;
  fftSize: number;

  constructor(cfg: BandAnalyzerConfig = {}) {
    this.bands = cfg.bands ?? DEFAULT_BANDS;
    this.sampleRate = cfg.sampleRate ?? 44100;
    this.fftSize = 1024;
  }

  // Configure FFT size (so bin->freq mapping is correct)
  setFFTSize(size: number) {
    this.fftSize = size;
  }

  // Convert single-sided FFT magnitudes -> band energies (RMS style)
  computeBandEnergies(
    mags: Float32Array,
    fftAnalyzer?: FFTAnalyzer,
  ): Float32Array {
    const out = new Float32Array(this.bands.length);
    const binCount = mags.length;
    const binFreq = (i: number) => (i * this.sampleRate) / this.fftSize;

    for (let b = 0; b < this.bands.length; b++) {
      const { lo, hi } = this.bands[b];
      let sumSq = 0;
      let count = 0;
      for (let i = 0; i < binCount; i++) {
        const f = binFreq(i);
        if (f >= lo && f < hi) {
          const v = mags[i];
          sumSq += v * v;
          count++;
        }
      }
      // energy definition: sqrt(sum(bin^2)) as requested (not averaged)
      out[b] = Math.sqrt(sumSq);
      // avoid tiny numbers
      if (!Number.isFinite(out[b])) out[b] = 0;
    }
    return out;
  }
}

export default BandAnalyzer;
