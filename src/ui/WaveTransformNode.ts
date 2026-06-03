import { INode, IPort, SignalValue } from './types';

export class WaveTransformNode implements INode {
  type = 'waveTransform';
  name = 'Wave Transform';
  inputs: Record<string, IPort> = {
    in: { id: 'in', name: 'In', value: 0 },
  };
  outputs: Record<string, IPort> = {
    out: { id: 'out', name: 'Out', value: 0 },
  };

  mode: 'sine' | 'cosine' = 'sine';
  density: number = 1.0;
  phase: number = 0;

  constructor(public id: string) {}

  process(_state: Record<string, any>, _sources: Record<string, SignalValue>) {
    const input = Number(this.inputs.in.value) || 0;

    // Obliczamy wartość fali: sin/cos(input * gęstość + faza)
    const angle = input * this.density + this.phase;
    const val = this.mode === 'sine' ? Math.sin(angle) : Math.cos(angle);

    this.outputs.out.value = val;
  }
}
