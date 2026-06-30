import {
  INode,
  IPort,
  NodeControlDefinition,
  PortDirection,
} from './types';

type PeakHoldState = {
  value?: number;
  heldUntil?: number;
  learnedPeak?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

export class PeakHoldDecayNode implements INode {
  id: string;
  name = 'Peak Hold + Decay';
  type = 'processor';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;
  enabled = true;

  decayFactor = 0.98;
  peakHoldTimeMs = 0;
  gain = 1;
  threshold = 0;
  autoNormalize = false;
  bypass = false;

  controls: NodeControlDefinition[] = [
    {
      key: 'decayFactor',
      label: 'Decay',
      kind: 'knob',
      min: 0.8,
      max: 0.99999,
      step: 0.00001,
      description: 'Falloff speed after hold time.',
    },
    {
      key: 'peakHoldTimeMs',
      label: 'Peak Hold Time',
      kind: 'knob',
      min: 0,
      max: 5000,
      step: 1,
      description: 'How long to hold a detected peak before decay starts.',
    },
    { key: 'gain', label: 'Gain', kind: 'knob', min: 0, max: 10, step: 0.01 },
    {
      key: 'threshold',
      label: 'Threshold',
      kind: 'knob',
      min: 0,
      max: 1,
      step: 0.001,
      description: 'Minimum value considered a peak.',
    },
    { key: 'autoNormalize', label: 'Auto Normalize', kind: 'toggle' },
    { key: 'bypass', label: 'Bypass', kind: 'toggle' },
  ];

  constructor(id: string) {
    this.id = id;
    this.inputs = {
      inputSignal: {
        id: 'inputSignal',
        name: 'inputSignal',
        direction: PortDirection.INPUT,
        nodeId: id,
        value: 0,
      },
    };
    this.outputs = {
      outputSignal: {
        id: 'outputSignal',
        name: 'outputSignal',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
      peakDetected: {
        id: 'peakDetected',
        name: 'peakDetected',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
      normalizedPeak: {
        id: 'normalizedPeak',
        name: 'normalizedPeak',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
    };
  }

  process(state: PeakHoldState) {
    const input = Number(this.inputs.inputSignal.value) || 0;

    if (this.enabled === false || this.bypass) {
      state.value = input;
      state.learnedPeak = Math.max(state.learnedPeak ?? 1, Math.abs(input));
      this.outputs.outputSignal.value = input;
      this.outputs.peakDetected.value = 0;
      this.outputs.normalizedPeak.value = clamp(input, 0, 1);
      return;
    }

    const now = performance.now();
    if (state.value === undefined) state.value = input;
    if (state.heldUntil === undefined) state.heldUntil = 0;
    if (state.learnedPeak === undefined) state.learnedPeak = Math.max(1, Math.abs(input));

    const gainedInput = input * this.gain;
    const threshold = clamp(this.threshold, 0, 1);
    const isPeak = gainedInput > state.value && gainedInput >= threshold;

    if (isPeak) {
      state.value = gainedInput;
      state.heldUntil = now + Math.max(0, this.peakHoldTimeMs);
    } else if (now >= state.heldUntil) {
      state.value *= clamp(this.decayFactor, 0.8, 0.99999);
    }

    state.learnedPeak = Math.max(state.learnedPeak * 0.9995, Math.abs(state.value), 0.0001);
    const normalized = this.autoNormalize
      ? state.value / state.learnedPeak
      : clamp(state.value, 0, 1);

    this.outputs.outputSignal.value = state.value;
    this.outputs.peakDetected.value = isPeak ? 1 : 0;
    this.outputs.normalizedPeak.value = clamp(normalized, 0, 1);
  }
}
