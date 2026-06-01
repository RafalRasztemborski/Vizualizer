import { INode, IPort, PortDirection } from './types';

export class ClampNode implements INode {
  id: string;
  name = 'Clamp';
  type = 'processor';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;
  enabled: boolean = true;

  min: number = 0;
  max: number = 1;

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

  process() {
    const val = this.inputs.in.value;
    if (this.enabled === false) {
      this.outputs.out.value = val;
      return;
    }

    // Ograniczenie wartości do zakresu [min, max]
    this.outputs.out.value = Math.max(this.min, Math.min(this.max, val));
  }
}
