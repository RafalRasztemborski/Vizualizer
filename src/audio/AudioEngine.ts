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
  bass: 0,
  mid: 0,
  high: 0,
  kickEnergy: 0,
  detectedKick: 0,
  nyquist: 22050,
  kick: 0,
  bassWithoutKick: 0,
  cleanedBass: 0,
  lastKickTime: 0,
  fps: 0,
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

  // Special Pause state fields
  private decodedBuffer: AudioBuffer | null = null;
  private loopSource: AudioBufferSourceNode | null = null;
  private specialPauseTime = 0;
  isSpecialPause = false;
  specialPauseLength = 1.0;

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

  get audioContext() {
    return this.context;
  }

  get audioMonitorNode() {
    return this.analyser;
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
    this.stopSpecialPause(false);
    this.disconnectSource();
    this.decodedBuffer = null;

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

    void this.decodeFile(file);
  }

  private async decodeFile(file: File) {
    try {
      await this.ensureContext();
      const arrayBuffer = await file.arrayBuffer();
      this.decodedBuffer = await this.context!.decodeAudioData(arrayBuffer);
    } catch (err) {
      console.error('Failed to decode audio file for Special Pause:', err);
    }
  }

  startSpecialPause(loopLength: number, pauseElement = true) {
    if (this.sourceKind !== 'file' || !this.decodedBuffer) return;

    this.isSpecialPause = true;
    this.specialPauseLength = loopLength;

    if (pauseElement) {
      this.specialPauseTime = this.audioElement.currentTime;
      this.audioElement.pause();
    }

    if (this.loopSource) {
      try {
        this.loopSource.stop();
      } catch (e) {}
      this.loopSource.disconnect();
      this.loopSource = null;
    }

    const duration = this.decodedBuffer.duration;
    const end = Math.min(duration, this.specialPauseTime);
    const start = Math.max(0, end - loopLength);

    if (end - start < 0.01) {
      return;
    }

    this.loopSource = this.context!.createBufferSource();
    this.loopSource.buffer = this.decodedBuffer;
    this.loopSource.loop = true;
    this.loopSource.loopStart = start;
    this.loopSource.loopEnd = end;

    this.loopSource.connect(this.analyser!);
    this.loopSource.start(0, start);
  }

  updateSpecialPauseLength(loopLength: number) {
    this.specialPauseLength = loopLength;
    if (!this.isSpecialPause) return;

    if (this.loopSource && this.decodedBuffer) {
      const duration = this.decodedBuffer.duration;
      const end = Math.min(duration, this.specialPauseTime);
      const start = Math.max(0, end - loopLength);
      this.loopSource.loopStart = start;
      this.loopSource.loopEnd = end;
    }
  }

  stopSpecialPause(resumePlayback = true) {
    if (!this.isSpecialPause) return;
    this.isSpecialPause = false;

    if (this.loopSource) {
      try {
        this.loopSource.stop();
      } catch (e) {}
      this.loopSource.disconnect();
      this.loopSource = null;
    }

    if (resumePlayback && this.sourceKind === 'file') {
      void this.audioElement.play();
    }
  }

  seek(time: number) {
    this.audioElement.currentTime = time;
    if (this.isSpecialPause) {
      this.specialPauseTime = time;
      this.startSpecialPause(this.specialPauseLength, false);
    }
  }

  update(fps: number = 0): ReactiveSignals {
    if (!this.context || !this.analyser) {
      return { ...EMPTY_SIGNALS };
    }

    // Read time-domain samples and run the DSP pipeline
    if (
      !this.timeDomainBuffer ||
      !this.fftAnalyzer ||
      !this.bandAnalyzer ||
      !this.featureExtractor ||
      !this.temporalAnalyzer
    ) {
      return { ...EMPTY_SIGNALS };
    }

    this.analyser.getFloatTimeDomainData(this.timeDomainBuffer as any);

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
      nyquist: this.context.sampleRate, // / 2,
      kick: state.onset ? 1 : 0,
      bassWithoutKick: legacyBass,
      cleanedBass: legacyBass,
      lastKickTime: 0,
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
    this.stopSpecialPause(false);
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
    this.stopSpecialPause(false);
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.source = undefined;
    this.audioElement.pause();
  }
}
