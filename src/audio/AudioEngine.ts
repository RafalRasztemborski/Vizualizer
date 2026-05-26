import {
  DEFAULT_AUDIO_BAND_CONFIG,
  EMPTY_SIGNALS,
  processAudioBands,
} from './audioBands';
import type { ReactiveSignals } from '../core/types';

export type AudioSourceKind = 'idle' | 'mic' | 'file';

export class AudioEngine {
  private context?: AudioContext;
  private analyser?: AnalyserNode;
  private source?: MediaStreamAudioSourceNode | MediaElementAudioSourceNode;
  private stream?: MediaStream;
  private bins = new Uint8Array(1024);
  private signals: ReactiveSignals = { ...EMPTY_SIGNALS };
  private audioElement = new Audio();
  private fileObjectUrl?: string;

  config = { ...DEFAULT_AUDIO_BAND_CONFIG };
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

  update(): ReactiveSignals {
    if (!this.context || !this.analyser) {
      return this.signals;
    }

    this.analyser.getByteFrequencyData(this.bins);
    this.signals = processAudioBands(this.bins, this.context.sampleRate, this.signals, this.config);
    return this.signals;
  }

  setConfigValue(key: string, value: number) {
    this.config = { ...this.config, [key]: value };
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
