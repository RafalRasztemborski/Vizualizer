import { INode, IPort, PortDirection } from './types';

export class CurveNode implements INode {
  id: string;
  name = 'Curve';
  type = 'processor';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;

  mode: 'power' | 'log' = 'power';
  exponent: number = 1.5;
  intensity: number = 9;

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
    const x = Math.max(0, this.inputs.in.value);
    let result = x;

    if (this.mode === 'power') {
      result = Math.pow(x, this.exponent);
    } else {
      result =
        Math.log10(1 + x * this.intensity) / Math.log10(1 + this.intensity);
    }

    this.outputs.out.value = result;
  }
}
