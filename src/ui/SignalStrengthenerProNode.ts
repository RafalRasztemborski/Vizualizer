import { INode, IPort, PortDirection } from './types';

export enum StrengthenerMode {
  POWER = 'power',
  DUAL_RANGE = 'dual_range',
}

export class SignalStrengthenerProNode implements INode {
  id: string;
  name = 'Signal Strengthener PRO';
  type = 'processor';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;
  enabled: boolean = true;

  // --- Parametry Konfiguracyjne ---
  mode: StrengthenerMode = StrengthenerMode.POWER;

  // Parametry trybu 1 (Power)
  p: number = 2.0; // Wykładnik potęgi

  // Parametry trybu 2 (Dual Range)
  b: number = 0.5; // Breakpoint - punkt podziału (0.0 - 1.0)
  d: number = 0.1; // Szerokość strefy przejścia (blending)
  lowExponent: number = 0.8; // Krzywa dolna (mała czułość)
  highExponent: number = 2.5; // Krzywa górna (duża czułość)

  constructor(id: string) {
    this.id = id;
    this.inputs = {
      in: {
        id: 'in',
        name: 'Input (0-1)',
        direction: PortDirection.INPUT,
        nodeId: id,
        value: 0,
      },
    };
    this.outputs = {
      out: {
        id: 'out',
        name: 'Output (1-100)',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 1,
      },
    };
  }

  /**
   * Funkcja Smoothstep: interpolacja wygładzona t^2 * (3 - 2t).
   */
  private smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  process(
    _state: Record<string, any>,
    _globalSources?: Record<string, number>,
  ) {
    // 1. Czyszczenie wejścia (dokładność do 3 miejsc po przecinku)
    const rawIn = this.inputs.in.value;
    const x = Math.round(Math.max(0, Math.min(1, rawIn)) * 1000) / 1000;
    const t = x;

    let n: number; // Znormalizowany wynik [0, 1]

    if (this.enabled === false) {
      n = t; // W trybie bypass przekazujemy surowy sygnał wejściowy do dalszej obróbki
    } else if (this.mode === StrengthenerMode.POWER) {
      // --- Tryb 1: Funkcja potęgowa ---
      n = Math.pow(t, this.p);
    } else {
      // --- Tryb 2: Dwuzakresowa czułość z Smooth Blending ---
      // Obliczamy wagę przejścia (0 = tylko dolna curve, 1 = tylko górna)
      const weight = this.smoothstep(this.b - this.d, this.b + this.d, t);

      // Obliczamy wartości dla obu charakterystyk
      const lowCurve = Math.pow(t, this.lowExponent);
      const highCurve = Math.pow(t, this.highExponent);

      // Miksujemy krzywe (Linear Interpolation na znormalizowanych krzywych)
      n = (1 - weight) * lowCurve + weight * highCurve;
    }

    // 2. Skalowanie do zakresu 1 - 100
    // Wzór: y = floor(100 * n) + 1
    let y = Math.floor(100 * n) + 1;

    // 3. Clampowanie końcowe (bezpieczeństwo przed wartością 101 przy n=1.0)
    this.outputs.out.value = Math.max(1, Math.min(100, y));
  }
}
