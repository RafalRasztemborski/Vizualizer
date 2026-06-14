import type p5 from 'p5';

export type NumericRecord = Record<string, number>;

export type ReactiveSignals = {
  dataArray: number[];
  centroid: number;
  flux: number;
  onset: number;
  beatPhase: number | null;
  band0: number;
  band1: number;
  band2: number;
  band3: number;
  band4: number;
  band5: number;
  // legacy fields kept optional for compatibility only
  detectedKick?: number;
  kick?: number;
  bass?: number;
  bassWithoutKick?: number;
  cleanedBass?: number;
  mid?: number;
  high?: number;
  kickEnergy?: number;
  lastKickTime?: number;
  nyquist?: number;
  fps?: number;
};

export type AnalyzerConfig = NumericRecord;

export type ParamDefinition = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
};

export type SketchParamValue = number | boolean | string;
export type SketchParams = Record<string, SketchParamValue>;

export type SketchParamDefinition =
  | {
      key: string;
      label: string;
      type: 'number';
      min: number;
      max: number;
      step: number;
      defaultValue: number;
    }
  | {
      key: string;
      label: string;
      type: 'boolean';
      defaultValue: boolean;
    }
  | {
      key: string;
      label: string;
      type: 'select';
      options: string[];
      defaultValue: string;
    };

export type RuntimeFrame = {
  p: p5;
  signals: ReactiveSignals;
  params: SketchParams;
  routedParams: NumericRecord;
  midi: NumericRecord;
  deltaMs: number;
  timeMs: number;
};

export type P5SketchModule = {
  id: string;
  name: string;
  description: string;
  params: SketchParamDefinition[];
  setup: (p: p5) => void;
  draw: (frame: RuntimeFrame) => void;
  windowResized?: (p: p5) => void;
  dispose?: () => void;
};

export type RouteProcessor = 'raw' | 'lerp' | 'envelope' | 'spring';

export type RouteMapping = {
  id: string;
  source: string;
  target: string;
  processor: RouteProcessor;
  amount: number;
  smoothing: number;
  attack: number;
  decay: number;
  sustain: number;
  min: number;
  max: number;
  enabled: boolean;

  // Opcjonalne wygładzanie (Smoothing)
  smoothingActive?: boolean;
  smoothWeightPrev?: number; // Płynność (waga poprzedniej wartości)
  smoothWeightNew?: number; // Responsywność (waga nowej wartości)

  // Nowy etap: Post-Lerp
  lerpActive?: boolean;
  lerpAmount?: number;

  // Opcjonalne parametry bramki
  gatewayMode?: 'none' | 'active';
  gatewayThreshold?: number; // Próg powyżej którego sygnał "otwiera" bramkę
  gatewayDecay?: number; // Szybkość
};
