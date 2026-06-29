import {
  INode,
  IPort,
  NodeControlDefinition,
  PortDirection,
} from './types';

export type ADSRTriggerMode =
  | 'retrigger'
  | 'ignore_while_active'
  | 'restart_from_current';
export type ADSRGateMode = 'one_shot' | 'hold_while_gate' | 'loop';
export type ADSRCurveShape = 'linear' | 'exponential' | 'logarithmic' | 'smoothstep';

type ADSRPhase = 'idle' | 'attack' | 'decay' | 'sustain' | 'release';

type ADSRState = {
  envelope?: number;
  phase?: ADSRPhase;
  phaseStartMs?: number;
  phaseStartLevel?: number;
  peakLevel?: number;
  previousTrigger?: number;
  previousInput?: number;
  releaseStartLevel?: number;
};

const PHASE_INDEX: Record<ADSRPhase, number> = {
  idle: 0,
  attack: 1,
  decay: 2,
  sustain: 3,
  release: 4,
};

const BPM_MS = 500;
const BPM_MULTIPLIERS: Record<string, number> = {
  '1/16': 1 / 16,
  '1/8': 1 / 8,
  '1/4': 1 / 4,
  '1/2': 1 / 2,
  '1': 1,
  '2': 2,
  '4': 4,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function curve(t: number, shape: ADSRCurveShape) {
  const x = clamp(t, 0, 1);
  if (shape === 'exponential') return x * x;
  if (shape === 'logarithmic') return 1 - Math.pow(1 - x, 2);
  if (shape === 'smoothstep') return x * x * (3 - 2 * x);
  return x;
}

export class ADSREnvelopeNode implements INode {
  id: string;
  name = 'ADSR Envelope';
  type = 'processor';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;
  enabled = true;

  attackMs = 80;
  decayMs = 180;
  sustain = 0.45;
  releaseMs = 450;
  peakLevel = 1;
  triggerMode: ADSRTriggerMode = 'retrigger';
  gateMode: ADSRGateMode = 'one_shot';
  curveShape: ADSRCurveShape = 'smoothstep';
  velocitySensitivity = 0;
  syncToBpm = false;
  bpmMultiplier = '1';
  gain = 1;
  bypass = false;

  controls: NodeControlDefinition[] = [
    { key: 'attackMs', label: 'Attack', kind: 'knob', min: 0, max: 5000, step: 1 },
    { key: 'decayMs', label: 'Decay', kind: 'knob', min: 0, max: 5000, step: 1 },
    { key: 'sustain', label: 'Sustain', kind: 'knob', min: 0, max: 1, step: 0.001 },
    { key: 'releaseMs', label: 'Release', kind: 'knob', min: 0, max: 10000, step: 1 },
    {
      key: 'peakLevel',
      label: 'Peak Level',
      kind: 'knob',
      min: 0,
      max: 2,
      step: 0.001,
      description: 'Maximum envelope level.',
    },
    {
      key: 'triggerMode',
      label: 'Trigger Mode',
      kind: 'dropdown',
      options: [
        { label: 'Retrigger', value: 'retrigger' },
        { label: 'Ignore While Active', value: 'ignore_while_active' },
        { label: 'Restart From Current Level', value: 'restart_from_current' },
      ],
    },
    {
      key: 'gateMode',
      label: 'Gate Mode',
      kind: 'dropdown',
      options: [
        { label: 'One Shot', value: 'one_shot' },
        { label: 'Hold While Gate', value: 'hold_while_gate' },
        { label: 'Loop', value: 'loop' },
      ],
    },
    {
      key: 'curveShape',
      label: 'Curve Shape',
      kind: 'dropdown',
      options: [
        { label: 'Linear', value: 'linear' },
        { label: 'Exponential', value: 'exponential' },
        { label: 'Logarithmic', value: 'logarithmic' },
        { label: 'Smoothstep', value: 'smoothstep' },
      ],
    },
    {
      key: 'velocitySensitivity',
      label: 'Velocity Sensitivity',
      kind: 'knob',
      min: 0,
      max: 1,
      step: 0.001,
      description: 'How strongly onset/input force affects ADSR amplitude.',
    },
    { key: 'syncToBpm', label: 'Sync To BPM', kind: 'toggle' },
    {
      key: 'bpmMultiplier',
      label: 'BPM Multiplier',
      kind: 'dropdown',
      options: Object.keys(BPM_MULTIPLIERS).map((value) => ({
        label: value,
        value,
      })),
    },
    { key: 'gain', label: 'Gain', kind: 'knob', min: 0, max: 10, step: 0.01 },
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
      trigger: {
        id: 'trigger',
        name: 'trigger',
        direction: PortDirection.INPUT,
        nodeId: id,
        value: 0,
      },
      gate: {
        id: 'gate',
        name: 'gate',
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
      envelope: {
        id: 'envelope',
        name: 'envelope',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
      phase: {
        id: 'phase',
        name: 'phase',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
      attackPhase: {
        id: 'attackPhase',
        name: 'attackPhase',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
      decayPhase: {
        id: 'decayPhase',
        name: 'decayPhase',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
      sustainPhase: {
        id: 'sustainPhase',
        name: 'sustainPhase',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
      releasePhase: {
        id: 'releasePhase',
        name: 'releasePhase',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
      active: {
        id: 'active',
        name: 'active',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
    };
  }

  private duration(ms: number) {
    if (!this.syncToBpm) return Math.max(0, ms);
    return BPM_MS * (BPM_MULTIPLIERS[this.bpmMultiplier] ?? 1);
  }

  private startPhase(state: ADSRState, phase: ADSRPhase, now: number) {
    state.phase = phase;
    state.phaseStartMs = now;
    state.phaseStartLevel = state.envelope ?? 0;
    if (phase === 'release') {
      state.releaseStartLevel = state.envelope ?? 0;
    }
  }

  private trigger(state: ADSRState, now: number, velocity: number) {
    const active = state.phase !== 'idle';
    if (active && this.triggerMode === 'ignore_while_active') return;

    const velocityGain = 1 + clamp(velocity, 0, 1) * this.velocitySensitivity;
    state.peakLevel = clamp(this.peakLevel * velocityGain, 0, 2);

    if (this.triggerMode === 'retrigger') {
      state.envelope = 0;
    }

    this.startPhase(state, 'attack', now);
  }

  process(state: ADSRState) {
    const input = Number(this.inputs.inputSignal.value) || 0;
    const triggerInput = Number(this.inputs.trigger.value) || 0;
    const gateInput = Number(this.inputs.gate.value) || 0;
    const now = performance.now();

    if (state.envelope === undefined) state.envelope = 0;
    if (state.phase === undefined) state.phase = 'idle';
    if (state.phaseStartMs === undefined) state.phaseStartMs = now;
    if (state.phaseStartLevel === undefined) state.phaseStartLevel = 0;
    if (state.previousTrigger === undefined) state.previousTrigger = 0;
    if (state.previousInput === undefined) state.previousInput = input;
    if (state.peakLevel === undefined) state.peakLevel = this.peakLevel;

    if (this.enabled === false || this.bypass) {
      state.envelope = input;
      state.phase = 'idle';
      this.writeOutputs(state);
      return;
    }

    const inputTrigger =
      input > 0.5 && state.previousInput <= 0.5 ? input : 0;
    const triggerRising =
      triggerInput > 0.5 && state.previousTrigger <= 0.5;
    if (triggerRising || inputTrigger > 0) {
      this.trigger(state, now, Math.max(triggerInput, inputTrigger, input));
    }

    state.previousTrigger = triggerInput;
    state.previousInput = input;

    const phaseElapsed = now - (state.phaseStartMs ?? now);
    const peak = state.peakLevel ?? this.peakLevel;

    if (state.phase === 'attack') {
      const duration = this.duration(this.attackMs);
      const t = duration <= 0 ? 1 : phaseElapsed / duration;
      state.envelope =
        (state.phaseStartLevel ?? 0) +
        (peak - (state.phaseStartLevel ?? 0)) * curve(t, this.curveShape);
      if (t >= 1) this.startPhase(state, 'decay', now);
    } else if (state.phase === 'decay') {
      const duration = this.duration(this.decayMs);
      const target = peak * clamp(this.sustain, 0, 1);
      const t = duration <= 0 ? 1 : phaseElapsed / duration;
      state.envelope = peak + (target - peak) * curve(t, this.curveShape);
      if (t >= 1) this.startPhase(state, 'sustain', now);
    } else if (state.phase === 'sustain') {
      state.envelope = peak * clamp(this.sustain, 0, 1);
      if (this.gateMode === 'one_shot') {
        this.startPhase(state, 'release', now);
      } else if (this.gateMode === 'hold_while_gate' && gateInput <= 0.5) {
        this.startPhase(state, 'release', now);
      } else if (this.gateMode === 'loop') {
        this.startPhase(state, 'attack', now);
      }
    } else if (state.phase === 'release') {
      const duration = this.duration(this.releaseMs);
      const start = state.releaseStartLevel ?? state.phaseStartLevel ?? state.envelope;
      const t = duration <= 0 ? 1 : phaseElapsed / duration;
      state.envelope = start * (1 - curve(t, this.curveShape));
      if (t >= 1) {
        state.envelope = 0;
        this.startPhase(state, 'idle', now);
      }
    }

    this.writeOutputs(state);
  }

  private writeOutputs(state: ADSRState) {
    const phase = state.phase ?? 'idle';
    const envelope = (state.envelope ?? 0) * this.gain;
    this.outputs.outputSignal.value = envelope;
    this.outputs.envelope.value = envelope;
    this.outputs.phase.value = PHASE_INDEX[phase];
    this.outputs.attackPhase.value = phase === 'attack' ? 1 : 0;
    this.outputs.decayPhase.value = phase === 'decay' ? 1 : 0;
    this.outputs.sustainPhase.value = phase === 'sustain' ? 1 : 0;
    this.outputs.releasePhase.value = phase === 'release' ? 1 : 0;
    this.outputs.active.value = phase !== 'idle' ? 1 : 0;
  }
}
