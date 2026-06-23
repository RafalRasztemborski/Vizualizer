export interface Features {
  energy: number;
  centroid: number;
  flux: number;
  peaks: boolean[];
}

export interface FeatureExtractorConfig {
  peakThresholdFactor?: number; // relative factor above previous band energy
}

export class FeatureExtractor {
  prevFFT: Float32Array | null = null;
  prevBands: Float32Array | null = null;
  peakThresholdFactor: number;

  constructor(cfg: FeatureExtractorConfig = {}) {
    this.peakThresholdFactor = cfg.peakThresholdFactor ?? 1.05; // 5% above previous
  }

  computeFeatures(
    mags: Float32Array,
    bands: Float32Array,
    sampleRate: number,
  ): Features {
    // Energy: sum of band energies (simple loudness proxy)
    let energy = 0;
    for (let i = 0; i < bands.length; i++) energy += bands[i];

    // Spectral centroid
    let centroid = 0;
    let magSum = 0;
    for (let i = 0; i < mags.length; i++) {
      const f = (i * sampleRate) / (mags.length * 2); // mags length is size/2
      const m = mags[i];
      centroid += f * m;
      magSum += m;
    }
    centroid = magSum > 0 ? centroid / magSum : 0;

    // Spectral flux
    let flux = 0;
    if (this.prevFFT) {
      const L = Math.min(mags.length, this.prevFFT.length);
      for (let i = 0; i < L; i++) {
        const d = mags[i] - this.prevFFT[i];
        if (d > 0) flux += d;
      }
    }

    // Peaks per band
    const peaks: boolean[] = [];
    for (let b = 0; b < bands.length; b++) {
      const prev = this.prevBands ? this.prevBands[b] : 0;
      const thr = prev * this.peakThresholdFactor + 1e-8;
      peaks[b] = bands[b] > thr && bands[b] > prev;
    }

    // store for next frame
    this.prevFFT = mags.slice(0);
    this.prevBands = bands.slice(0);

    return {
      energy,
      centroid,
      flux,
      peaks,
    };
  }
}

export default FeatureExtractor;
