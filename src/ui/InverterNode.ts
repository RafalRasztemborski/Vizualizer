import { INode, IPort, PortDirection } from './types';

export class InverterNode implements INode {
  id: string;
  name = 'Inverter';
  type = 'processor';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;
  enabled: boolean = true;

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

    this.outputs.out.value = -val;
  }
}
