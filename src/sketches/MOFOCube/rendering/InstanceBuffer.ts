import type { BoxColor } from '../types';

export const INSTANCE_FLOATS = 11;

export class InstanceBuffer {
  private data: Float32Array;
  private countValue = 0;

  constructor(initialCapacity = 1024) {
    this.data = new Float32Array(initialCapacity * INSTANCE_FLOATS);
  }

  get count() {
    return this.countValue;
  }

  get floatData() {
    return this.data.subarray(0, this.countValue * INSTANCE_FLOATS);
  }

  reset() {
    this.countValue = 0;
  }

  add(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: BoxColor,
  ) {
    this.ensureCapacity(this.countValue + 1);

    const rgb = hsbToRgb(color.hue, color.saturation, color.brightness);
    const offset = this.countValue * INSTANCE_FLOATS;

    this.data[offset] = x;
    this.data[offset + 1] = y;
    this.data[offset + 2] = z;
    this.data[offset + 3] = Math.max(1, sx);
    this.data[offset + 4] = Math.max(1, sy);
    this.data[offset + 5] = Math.max(1, sz);
    this.data[offset + 6] = rgb[0];
    this.data[offset + 7] = rgb[1];
    this.data[offset + 8] = rgb[2];
    this.data[offset + 9] = Math.max(0, Math.min(1, color.alpha / 255));
    this.data[offset + 10] = Math.max(0, Math.min(1, color.edgeAlpha / 255));
    this.countValue += 1;
  }

  private ensureCapacity(requiredCount: number) {
    const currentCapacity = this.data.length / INSTANCE_FLOATS;
    if (requiredCount <= currentCapacity) return;

    let nextCapacity = currentCapacity;
    while (nextCapacity < requiredCount) {
      nextCapacity *= 2;
    }

    const next = new Float32Array(nextCapacity * INSTANCE_FLOATS);
    next.set(this.data);
    this.data = next;
  }
}

function hsbToRgb(hue: number, saturation: number, brightness: number) {
  const h = (((hue % 360) + 360) % 360) / 60;
  const s = Math.max(0, Math.min(1, saturation / 100));
  const v = Math.max(0, Math.min(1, brightness / 100));
  const c = v * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = v - c;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 1) {
    r = c;
    g = x;
  } else if (h < 2) {
    r = x;
    g = c;
  } else if (h < 3) {
    g = c;
    b = x;
  } else if (h < 4) {
    g = x;
    b = c;
  } else if (h < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return [r + m, g + m, b + m] as const;
}
