import { INode, IPort, PortDirection } from './types';

export class SignalStrengthNode implements INode {
  id: string;
  name = 'Signal Strength';
  type = 'processor';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;
  enabled: boolean = true;

  multiplier: number = 10;
  offset: number = 0;

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
    if (this.enabled === false) {
      this.outputs.out.value = this.inputs.in.value;
      return;
    }

    this.outputs.out.value =
      (this.inputs.in.value - this.offset) * this.multiplier;
  }
}
