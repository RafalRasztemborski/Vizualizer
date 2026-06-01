import { INode, IPort, PortDirection } from './types';

export class LerpNode implements INode {
  id: string;
  name = 'Lerp';
  type = 'processor';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;
  enabled: boolean = true;

  factor: number = 0.1;

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

  process(state: { current?: number }) {
    const target = this.inputs.in.value;

    if (this.enabled === false) {
      state.current = target;
      this.outputs.out.value = target;
      return;
    }

    // Inicjalizacja stanu wewnętrznego noda
    if (state.current === undefined) state.current = target;

    // Klasyczny LERP: current += (target - current) * factor
    state.current += (target - state.current) * this.factor;

    this.outputs.out.value = state.current;
  }
}
