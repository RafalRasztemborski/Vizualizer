import {
  INode,
  IPort,
  NodeControlDefinition,
  PortDirection,
} from './types';

type AttackReleaseState = {
  envelope?: number;
  previousEnvelope?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

export class AttackReleaseFollowerNode implements INode {
  id: string;
  name = 'Attack / Release';
  type = 'processor';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;
  enabled = true;

  attackCoef = 0.15;
  releaseCoef = 0.03;
  gain = 1;
  clampEnabled = false;
  minOutput = 0;
  maxOutput = 1;
  bypass = false;

  controls: NodeControlDefinition[] = [
    {
      key: 'attackCoef',
      label: 'Attack',
      kind: 'knob',
      min: 0.001,
      max: 1,
      step: 0.001,
      description: 'How quickly the envelope reacts to rising signal.',
    },
    {
      key: 'releaseCoef',
      label: 'Release',
      kind: 'knob',
      min: 0.001,
      max: 1,
      step: 0.001,
      description: 'How quickly the envelope falls.',
    },
    { key: 'gain', label: 'Gain', kind: 'knob', min: 0, max: 10, step: 0.01 },
    { key: 'clampEnabled', label: 'Output Clamp', kind: 'toggle' },
    {
      key: 'minOutput',
      label: 'Min Output',
      kind: 'knob',
      min: 0,
      max: 1,
      step: 0.001,
    },
    {
      key: 'maxOutput',
      label: 'Max Output',
      kind: 'knob',
      min: 0,
      max: 1,
      step: 0.001,
    },
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
      rising: {
        id: 'rising',
        name: 'rising',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
      falling: {
        id: 'falling',
        name: 'falling',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
      velocity: {
        id: 'velocity',
        name: 'velocity',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
    };
  }

  process(state: AttackReleaseState) {
    const input = Number(this.inputs.inputSignal.value) || 0;

    if (this.enabled === false || this.bypass) {
      state.envelope = input;
      state.previousEnvelope = input;
      this.outputs.outputSignal.value = input;
      this.outputs.rising.value = 0;
      this.outputs.falling.value = 0;
      this.outputs.velocity.value = 0;
      return;
    }

    if (state.envelope === undefined) state.envelope = input;
    if (state.previousEnvelope === undefined) state.previousEnvelope = state.envelope;

    const attack = clamp(this.attackCoef, 0.001, 1);
    const release = clamp(this.releaseCoef, 0.001, 1);
    const coef = input > state.envelope ? attack : release;
    state.envelope += (input - state.envelope) * coef;

    let output = state.envelope * this.gain;
    if (this.clampEnabled) {
      output = clamp(output, Math.min(this.minOutput, this.maxOutput), Math.max(this.minOutput, this.maxOutput));
    }

    const velocity = state.envelope - state.previousEnvelope;
    state.previousEnvelope = state.envelope;

    this.outputs.outputSignal.value = output;
    this.outputs.rising.value = velocity > 0.0001 ? 1 : 0;
    this.outputs.falling.value = velocity < -0.0001 ? 1 : 0;
    this.outputs.velocity.value = velocity;
  }
}
