import { hannWindow, applyWindow } from './dspUtils';

export interface FFTConfig {
  size?: number; // must be power of two
  sampleRate?: number;
  window?: 'hann' | 'rect';
}

// Minimal, efficient radix-2 FFT implementation (in-place, iterative)
class FFT {
  size: number;
  cosTable: Float64Array;
  sinTable: Float64Array;

  constructor(size: number) {
    if ((size & (size - 1)) !== 0)
      throw new Error('FFT size must be power of two');
    this.size = size;
    this.cosTable = new Float64Array(size / 2);
    this.sinTable = new Float64Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      this.cosTable[i] = Math.cos((2 * Math.PI * i) / size);
      this.sinTable[i] = Math.sin((2 * Math.PI * i) / size);
    }
  }

  // in-place complex FFT. real[] and imag[] have length = size
  transform(real: Float64Array, imag: Float64Array) {
    const n = this.size;
    // bit reversal
    let j = 0;
    for (let i = 1; i < n; i++) {
      let bit = n >> 1;
      while (j & bit) {
        j ^= bit;
        bit >>= 1;
      }
      j ^= bit;
      if (i < j) {
        let tr = real[i];
        real[i] = real[j];
        real[j] = tr;
        let ti = imag[i];
        imag[i] = imag[j];
        imag[j] = ti;
      }
    }

    // Danielson-Lanczos
    for (let len = 2; len <= n; len <<= 1) {
      const halfLen = len >> 1;
      const tableStep = n / len;
      for (let i = 0; i < n; i += len) {
        let k = 0;
        for (let j = 0; j < halfLen; j++) {
          const tpre =
            real[i + j + halfLen] * this.cosTable[k] +
            imag[i + j + halfLen] * this.sinTable[k];
          const tpim =
            -real[i + j + halfLen] * this.sinTable[k] +
            imag[i + j + halfLen] * this.cosTable[k];
          real[i + j + halfLen] = real[i + j] - tpre;
          imag[i + j + halfLen] = imag[i + j] - tpim;
          real[i + j] += tpre;
          imag[i + j] += tpim;
          k += tableStep;
        }
      }
    }
  }
}

export class FFTAnalyzer {
  size: number;
  sampleRate: number;
  windowFn: Float32Array;
  fft: FFT;

  constructor(cfg: FFTConfig = {}) {
    this.size = cfg.size ?? 1024;
    this.sampleRate = cfg.sampleRate ?? 44100;
    this.windowFn =
      cfg.window === 'rect'
        ? new Float32Array(this.size).fill(1)
        : hannWindow(this.size);
    this.fft = new FFT(this.size);
  }

  // Input: time-domain samples of length `size` (Float32Array)
  // Output: magnitudes for bins 0..size/2-1 (Float32Array)
  computeMagnitudes(input: Float32Array): Float32Array {
    if (input.length !== this.size) {
      // If input shorter, zero-pad; if longer, take last `size` samples
      const tmp = new Float32Array(this.size);
      if (input.length < this.size) tmp.set(input);
      else tmp.set(input.subarray(input.length - this.size));
      input = tmp;
    }

    const windowed = applyWindow(input, this.windowFn);

    // prepare real/imag arrays as Float64 for numerical stability
    const real = new Float64Array(this.size);
    const imag = new Float64Array(this.size);
    for (let i = 0; i < this.size; i++) real[i] = windowed[i];

    this.fft.transform(real, imag);

    const half = this.size / 2;
    const mags = new Float32Array(half);
    // scale: divide by size to get amplitude normalized by window energy
    for (let i = 0; i < half; i++) {
      const mag = (Math.hypot(real[i], imag[i]) / this.size) * 2; // *2 to account for single-sided
      mags[i] = mag;
    }
    return mags;
  }

  // helper: bin index -> center frequency
  binFreq(binIndex: number) {
    return (binIndex * this.sampleRate) / this.size;
  }
}

export default FFTAnalyzer;
