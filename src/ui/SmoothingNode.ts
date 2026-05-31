import { INode, IPort, PortDirection } from './types';

export class SmoothingNode implements INode {
  id: string;
  name = 'Smoothing';
  type = 'processor';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;

  // Parametry regulowane przez suwaki w UI
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

    // Inicjalizacja stanu wewnętrznego noda (pamięć między klatkami)
    if (state.current === undefined) state.current = target;

    // NOWE (LERP: current += (target - current) * factor;)
    state.current += (target - state.current) * this.factor;

    this.outputs.out.value = state.current;
  }
}
