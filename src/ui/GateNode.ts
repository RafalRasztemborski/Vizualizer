import {
  INode,
  IPort,
  NodeControlDefinition,
  PortDirection,
} from './types';

export type GateMode = 'above' | 'below' | 'between' | 'outside';

type GateState = {
  amount?: number;
  isOpen?: boolean;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export class GateNode implements INode {
  id: string;
  name = 'Gate';
  type = 'processor';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;
  enabled = true;

  mode: GateMode = 'above';
  threshold = 0.08;
  thresholdHigh = 1;
  hysteresis = 0.015;
  attack = 0.25;
  release = 0.08;
  floor = 0;
  gain = 1;
  bypass = false;

  controls: NodeControlDefinition[] = [
    {
      key: 'mode',
      label: 'Condition',
      kind: 'dropdown',
      options: [
        { label: 'Above', value: 'above' },
        { label: 'Below', value: 'below' },
        { label: 'Between', value: 'between' },
        { label: 'Outside', value: 'outside' },
      ],
    },
    {
      key: 'threshold',
      label: 'Threshold',
      kind: 'knob',
      min: 0,
      max: 1,
      step: 0.001,
      description: 'Lower threshold for opening the gate.',
    },
    {
      key: 'thresholdHigh',
      label: 'High Thr',
      kind: 'knob',
      min: 0,
      max: 1,
      step: 0.001,
      description: 'Upper threshold used by Between/Outside modes.',
    },
    {
      key: 'hysteresis',
      label: 'Hysteresis',
      kind: 'knob',
      min: 0,
      max: 0.2,
      step: 0.001,
      description: 'Prevents rapid flicker around the threshold.',
    },
    {
      key: 'attack',
      label: 'Open',
      kind: 'knob',
      min: 0.001,
      max: 1,
      step: 0.001,
      description: 'How fast the gate opens.',
    },
    {
      key: 'release',
      label: 'Close',
      kind: 'knob',
      min: 0.001,
      max: 1,
      step: 0.001,
      description: 'How fast the gate closes.',
    },
    {
      key: 'floor',
      label: 'Floor',
      kind: 'knob',
      min: 0,
      max: 1,
      step: 0.001,
      description: 'Minimum gate amount while closed.',
    },
    { key: 'gain', label: 'Gain', kind: 'knob', min: 0, max: 10, step: 0.01 },
    { key: 'bypass', label: 'Bypass', kind: 'toggle' },
  ];

  constructor(id: string) {
    this.id = id;
    this.inputs = {
      in: {
        id: 'in',
        name: 'Input',
        direction: PortDirection.INPUT,
        nodeId: id,
        value: 0,
      },
    };
    this.outputs = {
      out: {
        id: 'out',
        name: 'Output',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
      gate: {
        id: 'gate',
        name: 'Gate',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
    };
  }

  private shouldOpen(input: number, wasOpen: boolean) {
    const low = Math.min(this.threshold, this.thresholdHigh);
    const high = Math.max(this.threshold, this.thresholdHigh);
    const h = Math.max(0, this.hysteresis);

    if (this.mode === 'below') {
      return wasOpen ? input < this.threshold + h : input < this.threshold;
    }

    if (this.mode === 'between') {
      return wasOpen
        ? input >= low - h && input <= high + h
        : input >= low && input <= high;
    }

    if (this.mode === 'outside') {
      return wasOpen
        ? input < low + h || input > high - h
        : input < low || input > high;
    }

    return wasOpen ? input > this.threshold - h : input > this.threshold;
  }

  process(state: GateState) {
    const input = Number(this.inputs.in.value) || 0;

    if (this.enabled === false || this.bypass) {
      state.amount = 1;
      state.isOpen = true;
      this.outputs.out.value = input;
      this.outputs.gate.value = 1;
      return;
    }

    if (state.amount === undefined) state.amount = 0;
    const isOpen = this.shouldOpen(input, state.isOpen ?? false);
    const target = isOpen ? 1 : clamp01(this.floor);
    const speed = isOpen ? this.attack : this.release;

    state.amount += (target - state.amount) * clamp01(speed);
    state.isOpen = isOpen;

    this.outputs.gate.value = state.amount;
    this.outputs.out.value = input * state.amount * Math.max(0, this.gain);
  }
}
