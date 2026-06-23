import { INode, IPort, PortDirection } from './types';

const SILENCE_THRESHOLD = 0.02;
const ENVELOPE_ATTACK = 0.55;
const ENVELOPE_RELEASE = 0.06;

export type OffsetNodeState = {
  activeOffset: number;
  envelope: number;
};

export class OffsetNode implements INode {
  id: string;
  name = 'Zero Offset';
  type = 'processor';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;
  enabled: boolean = true;

  /** Wartość wejściowa traktowana jako nowe zero (output = input - offset). */
  offset: number = 0;
  /** Gdy true, przy ciszy aktywny offset wraca liniowo do 0. */
  returnOnSilence: boolean = false;
  /** Szybkość powrotu / dojścia do docelowego offsetu (lerp). */
  returnSpeed: number = 0.06;

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
    };
  }

  process(state: OffsetNodeState) {
    const val = this.inputs.in.value;

    if (this.enabled === false) {
      state.activeOffset = this.offset;
      state.envelope = Math.abs(val);
      this.outputs.out.value = val;
      return;
    }

    const magnitude = Math.abs(val);
    if (state.envelope === undefined) state.envelope = magnitude;
    if (state.activeOffset === undefined) state.activeOffset = this.offset;

    const followRate =
      magnitude > state.envelope ? ENVELOPE_ATTACK : ENVELOPE_RELEASE;
    state.envelope += (magnitude - state.envelope) * followRate;

    const silent = state.envelope < SILENCE_THRESHOLD;
    const targetOffset =
      this.returnOnSilence && silent ? 0 : this.offset;

    state.activeOffset +=
      (targetOffset - state.activeOffset) * this.returnSpeed;

    this.outputs.out.value = val - state.activeOffset;
  }
}
