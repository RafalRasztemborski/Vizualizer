import type p5 from 'p5';
import type { NumericRecord, SketchParams } from '../../core/types';
import { boolParam, routedNumber } from './helpers';
import type { BoxColor, WallName } from './types';

export function drawBox(
  p: p5,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color: BoxColor,
) {
  p.push();
  p.translate(x, y, z);
  if (color.edgeAlpha > 0) {
    p.stroke(0, 0, 0, color.edgeAlpha);
  } else {
    p.noStroke();
  }
  p.fill(color.hue, color.saturation, color.brightness, color.alpha);
  p.emissiveMaterial(
    color.hue,
    color.saturation,
    color.brightness,
    color.alpha,
  );
  p.box(Math.max(1, sx), Math.max(1, sy), Math.max(1, sz));
  p.pop();
}


export function colorForBox(
  params: SketchParams,
  routedParams: NumericRecord,
  wall: WallName,
  falloff: number,
  audioLift: number,
  timeMs: number,
): BoxColor {
  const baseHue = routedNumber(params, routedParams, 'hue', 142);
  const spread = routedNumber(params, routedParams, 'colorSpread', 150);
  const saturation = Math.max(
    0,
    Math.min(100, routedNumber(params, routedParams, 'saturation', 86)),
  );
  const brightness = Math.max(
    0,
    Math.min(100, routedNumber(params, routedParams, 'brightness', 92)),
  );
  const alpha = Math.max(
    0,
    Math.min(255, routedNumber(params, routedParams, 'opacity', 230)),
  );
  const edgeAlpha = Math.max(
    0,
    Math.min(255, routedNumber(params, routedParams, 'edgeAlpha', 230)),
  );
  const wallShift = {
    front: 0,
    back: 8,
    left: 18,
    right: 24,
    top: 32,
    bottom: 38,
  }[wall];

  if (boolParam(params, 'dynamicLight', true)) {
    const t = timeMs * 0.005;
    return {
      hue:
        (baseHue + wallShift + Math.sin(t + wallShift) * 8 + audioLift * 36) %
        360,
      saturation,
      brightness: Math.min(100, brightness + audioLift * 28),
      alpha,
      edgeAlpha,
    };
  }

  return {
    hue: (baseHue + wallShift + falloff * spread + audioLift * 24) % 360,
    saturation,
    brightness: Math.min(
      100,
      brightness * (0.68 + falloff * 0.32) + audioLift * 24,
    ),
    alpha,
    edgeAlpha,
  };
}

