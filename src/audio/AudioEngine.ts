import type { ReactiveSignals } from '../core/types';
import {
  FFTAnalyzer,
  BandAnalyzer,
  FeatureExtractor,
  TemporalAnalyzer,
} from './index';

export const DEFAULT_AUDIO_ENGINE_CONFIG = {
  historyMs: 400,
  smoothingMode: 0,
  emaAlpha: 0.25,
  lookAheadFrames: 4,
  onsetThreshold: 0.01,
  bpm: 120,
} as const;

export type AudioEngineConfig = {
  [K in keyof typeof DEFAULT_AUDIO_ENGINE_CONFIG]: number;
};

export const AUDIO_ENGINE_CONTROLS: Record<
  keyof AudioEngineConfig,
  {
    label: string;
    min: number;
    max: number;
    step: number;
    format?: (value: number) => string;
  }
> = {
  historyMs: { label: 'History (ms)', min: 100, max: 1000, step: 50 },
  smoothingMode: { label: 'Smoothing Mode', min: 0, max: 1, step: 1 },
  emaAlpha: { label: 'EMA Alpha', min: 0.01, max: 1, step: 0.01 },
  lookAheadFrames: { label: 'Lookahead Frames', min: 0, max: 10, step: 1 },
  onsetThreshold: { label: 'Onset Threshold', min: 0, max: 0.2, step: 0.001 },
  bpm: { label: 'Beat BPM', min: 40, max: 220, step: 1 },
};

export const EMPTY_SIGNALS: ReactiveSignals = {
  dataArray: [],
  centroid: 0,
  flux: 0,
  onset: 0,
  beatPhase: 0,
  band0: 0,
  band1: 0,
  band2: 0,
  band3: 0,
  band4: 0,
  band5: 0,
};

export type AudioSourceKind = 'idle' | 'mic' | 'file';

export class AudioEngine {
  private context?: AudioContext;
  private analyser?: AnalyserNode;
  private source?: MediaStreamAudioSourceNode | MediaElementAudioSourceNode;
  private stream?: MediaStream;
  private bins = new Uint8Array(1024);
  private signals: ReactiveSignals = { ...EMPTY_SIGNALS };
  private fftAnalyzer?: FFTAnalyzer;
  private bandAnalyzer?: BandAnalyzer;
  private featureExtractor?: FeatureExtractor;
  private temporalAnalyzer?: TemporalAnalyzer;
  private timeDomainBuffer?: Float32Array;
  private audioElement = new Audio();
  private fileObjectUrl?: string;

  config: AudioEngineConfig = { ...DEFAULT_AUDIO_ENGINE_CONFIG };
  sourceKind: AudioSourceKind = 'idle';

  constructor() {
    this.audioElement.crossOrigin = 'anonymous';
  }

  get element() {
    return this.audioElement;
  }

  get currentSignals() {
    return this.signals;
  }

  async ensureContext() {
    if (!this.context) {
      this.context = new AudioContext();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.72;
      this.bins = new Uint8Array(this.analyser.frequencyBinCount);

      // Initialize DSP pipeline components
      const fftSize = this.analyser.fftSize;
      this.fftAnalyzer = new FFTAnalyzer({
        size: fftSize,
        sampleRate: this.context.sampleRate,
      });
      this.bandAnalyzer = new BandAnalyzer({
        sampleRate: this.context.sampleRate,
      });
      this.bandAnalyzer.setFFTSize(fftSize);
      this.featureExtractor = new FeatureExtractor();
      this.temporalAnalyzer = new TemporalAnalyzer({
        historyMs: this.config.historyMs,
        fps: 60,
        smoothing: this.config.smoothingMode === 1 ? 'ema' : 'gaussian',
        emaAlpha: this.config.emaAlpha,
        lookAheadFrames: this.config.lookAheadFrames,
        onsetThreshold: this.config.onsetThreshold,
        bpm: this.config.bpm,
      });
      this.timeDomainBuffer = new Float32Array(fftSize);
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  async useMicrophone() {
    await this.ensureContext();
    this.disconnectSource();

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    this.source = this.context!.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser!);
    this.sourceKind = 'mic';
  }

  async useFile(file: File) {
    await this.ensureContext();
    this.disconnectSource();

    if (this.fileObjectUrl) {
      URL.revokeObjectURL(this.fileObjectUrl);
    }

    this.fileObjectUrl = URL.createObjectURL(file);
    this.audioElement.src = this.fileObjectUrl;
    this.audioElement.load();
    this.source = this.context!.createMediaElementSource(this.audioElement);
    this.source.connect(this.analyser!);
    this.analyser!.connect(this.context!.destination);
    this.sourceKind = 'file';
  }

  update(fps: number = 0): ReactiveSignals {
    if (!this.context || !this.analyser) {
      return this.signals;
    }

    // Read time-domain samples and run the DSP pipeline
    if (
      !this.timeDomainBuffer ||
      !this.fftAnalyzer ||
      !this.bandAnalyzer ||
      !this.featureExtractor ||
      !this.temporalAnalyzer
    ) {
      return this.signals;
    }

    this.analyser.getFloatTimeDomainData(this.timeDomainBuffer);

    const mags = this.fftAnalyzer.computeMagnitudes(this.timeDomainBuffer);
    const bands = this.bandAnalyzer.computeBandEnergies(mags);
    const features = this.featureExtractor.computeFeatures(
      mags,
      bands,
      this.context.sampleRate,
    );
    this.temporalAnalyzer.push(bands, features);
    const state = this.temporalAnalyzer.update();

    // Map TemporalOutput -> ReactiveSignals
    // dataArray: normalized magnitudes for optional visualization
    const maxMag = mags.length ? mags.reduce((a, b) => Math.max(a, b), 0) : 1;
    const dataArray = Array.from(mags).map((v) =>
      maxMag > 0 ? v / maxMag : 0,
    );

    const bandsValue = state.smoothedBands;
    const legacyBass = bandsValue[0] ?? 0;
    const legacyMid = bandsValue[3] ?? 0;
    const legacyHigh = bandsValue[5] ?? 0;

    this.signals = {
      dataArray,
      centroid: state.smoothedCentroid,
      flux: state.smoothedFlux,
      onset: state.onset,
      beatPhase: state.beatPhase ?? null,
      band0: state.smoothedBands[0] ?? 0,
      band1: state.smoothedBands[1] ?? 0,
      band2: state.smoothedBands[2] ?? 0,
      band3: state.smoothedBands[3] ?? 0,
      band4: state.smoothedBands[4] ?? 0,
      band5: state.smoothedBands[5] ?? 0,
      // Legacy aliases for backward compatibility with older sketches
      bass: legacyBass,
      mid: legacyMid,
      high: legacyHigh,
      kickEnergy: state.onset * 2,
      detectedKick: state.onset ? 1 : 0,
      nyquist: this.context.sampleRate / 2,
      fps,
    };

    return this.signals;
  }

  setConfigValue(key: keyof AudioEngineConfig, value: number) {
    this.config = { ...this.config, [key]: value };
    if (!this.temporalAnalyzer) return;
    if (key === 'historyMs') this.temporalAnalyzer.historyMs = value;
    if (key === 'emaAlpha') this.temporalAnalyzer.emaAlpha = value;
    if (key === 'lookAheadFrames')
      this.temporalAnalyzer.lookAheadFrames = value;
    if (key === 'onsetThreshold') this.temporalAnalyzer.onsetThreshold = value;
    if (key === 'bpm') this.temporalAnalyzer.bpm = value;
    if (key === 'smoothingMode') {
      this.temporalAnalyzer.smoothing = value === 1 ? 'ema' : 'gaussian';
    }
  }

  stop() {
    this.disconnectSource();
    this.sourceKind = 'idle';
  }

  dispose() {
    this.stop();
    if (this.fileObjectUrl) {
      URL.revokeObjectURL(this.fileObjectUrl);
    }
    void this.context?.close();
  }

  private disconnectSource() {
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.source = undefined;
    this.audioElement.pause();
  }
}
