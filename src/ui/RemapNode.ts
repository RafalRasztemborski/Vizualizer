import { INode, IPort, PortDirection } from './types';

export class RemapNode implements INode {
  id: string;
  name = 'Remap';
  type = 'processor';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;
  enabled: boolean = true;

  inMin: number = 0.65;
  inMax: number = 0.75;
  outMin: number = 5;
  outMax: number = 15;

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


    // Formuła Remap:
    // t = (val - inMin) / (inMax - inMin)
    // result = outMin + t * (outMax - outMin)

    const rangeIn = this.inMax - this.inMin;
    const rangeOut = this.outMax - this.outMin;

    if (Math.abs(rangeIn) < 0.0001) {
      this.outputs.out.value = this.outMin;
      return;
    }

    const t = (val - this.inMin) / rangeIn;
    const result = this.outMin + t * rangeOut;

    this.outputs.out.value = result;
  }
}
