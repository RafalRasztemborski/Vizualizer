export { AudioEngine } from './src/audio/AudioEngine';
export {
  DEFAULT_AUDIO_BAND_CONFIG,
  EMPTY_SIGNALS,
  inferConfigControls,
  processAudioBands,
} from './src/audio/audioBands';
export { MidiManager } from './src/midi/MidiManager';
export { applyRouting, createRoute } from './src/routing/routing';
export { sketches } from './src/sketches/registry';
export type {
  AnalyzerConfig,
  NumericRecord,
  P5SketchModule,
  ParamDefinition,
  ReactiveSignals,
  RouteMapping,
  RuntimeFrame,
  SketchParamDefinition,
  SketchParams,
} from './src/core/types';
