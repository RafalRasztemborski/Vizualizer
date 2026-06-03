import { INode, IPort, PortDirection, SignalValue } from './types';

export class WaveTransformNode implements INode {
  id: string;
  type = 'waveTransform';
  name = 'Wave Transform';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;
  enabled: boolean = true;

  mode: 'sine' | 'cosine' = 'sine';
  density: number = 1.0;
  phase: number = 0;

  constructor(id: string) {
    this.id = id;
    this.inputs = {
      in: {
        id: 'in',
        name: 'In',
        direction: PortDirection.INPUT,
        nodeId: id,
        value: 0,
      },
    };
    this.outputs = {
      out: {
        id: 'out',
        name: 'Out',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
    };
  }

  process(_state: Record<string, any>, _sources: Record<string, SignalValue>) {
    const input = Number(this.inputs.in.value) || 0;
    if (this.enabled === false) {
      this.outputs.out.value = input;
      return;
    }

    // Obliczamy wartość fali: sin/cos(input * gęstość + faza)
    const angle = input * this.density + this.phase;
    const val = this.mode === 'sine' ? Math.sin(angle) : Math.cos(angle);

    this.outputs.out.value = val;
  }
}
