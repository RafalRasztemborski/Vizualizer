import { INode, IPort, PortDirection } from './types';

export class TargetNode implements INode {
  id: string;
  name = 'Sketch Target';
  type = 'target';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort> = {};

  targetParam: string;
  enabled: boolean = true;

  constructor(id: string, targetParam: string) {
    this.id = id;
    this.targetParam = targetParam;
    this.inputs = {
      in: {
        id: 'in',
        name: targetParam,
        direction: PortDirection.INPUT,
        nodeId: id,
        value: 0,
      },
    };
  }

  process() {
    // Target Node po prostu przyjmuje sygnał.
    // Wartość jest odczytywana przez system zewnętrzny z inputs.in.value
  }
}
