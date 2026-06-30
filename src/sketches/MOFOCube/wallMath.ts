import type { NumericRecord, SketchParams } from '../../core/types';
import {
  clamp01,
  routedNumber,
  sineFalloff,
  serpentinePosition,
  spectrumValueHz,
} from './helpers';

export function wallEdgeOffset(
  strength: number,
  direction: 'negative' | 'positive',
  anim: number,
) {
  return (
    (direction === 'positive' ? 1 : -1) * anim * (0.5 + Math.max(0, strength))
  );
}

export function archStrengthWithSine(
  params: SketchParams,
  routedParams: NumericRecord,
  key: string,
  fallback: number,
  position: number,
) {
  const baseStrength = routedNumber(params, routedParams, key, fallback);
  const density = Math.max(
    0,
    routedNumber(params, routedParams, 'sinDensity', 0),
  );
  if (density <= 0) return baseStrength;

  const phase = routedNumber(params, routedParams, 'sinPhase', 0);
  return baseStrength * Math.sin(position * density * Math.PI * 2 + phase);
}

export function wallMotion(
  anim: number,
  archStrength: number,
  wallPower: number,
  falloff: number,
  centerPowerMask: number,
  step: number,
) {
  const negativeArchMask = clamp01(-archStrength / 4);
  const edgePulseFloor = 0.12 * negativeArchMask;
  const shapedPowerMask = Math.max(centerPowerMask, edgePulseFloor);
  const powerSpreadMask =
    1 - negativeArchMask + shapedPowerMask * negativeArchMask;
  const effectiveWallPower = wallPower * powerSpreadMask;
  const bounceOffset = anim * 0.5 * powerSpreadMask;

  return {
    startOffset: falloff * archStrength * step + bounceOffset,
    sizeAdd: Math.abs(anim) * effectiveWallPower,
  };
}

export function frontBackWallAnim(
  x: number,
  y: number,
  xRows: number,
  yRows: number,
  audioDepth: number,
  frontBackPulse: number,
  spectrum: number[],
  nyquist: number,
  params: SketchParams,
  routedParams: NumericRecord,
) {
  const fx = sineFalloff(x - 1, xRows - 2);
  const fy = sineFalloff(y - 1, yRows - 2);
  const falloff = (fx + fy) / 2;
  const spectralEnergy = spectrumValueHz(
    spectrum,
    nyquist,
    serpentinePosition(x, xRows, y, yRows),
    2500,
    12000,
  );
  const energy = spectralEnergy * 1.25 + frontBackPulse * 0.15;

  return falloff * energy * audioDepth;
}

export function topBottomWallAnim(
  x: number,
  z: number,
  xRows: number,
  zRows: number,
  audioDepth: number,
  topBottomPulse: number,
  spectrum: number[],
  nyquist: number,
  params: SketchParams,
  routedParams: NumericRecord,
) {
  const fx = sineFalloff(x - 1, xRows - 2);
  const fz = sineFalloff(z - 1, zRows - 2);
  const falloff = (fx + fz) / 2;
  const spectralEnergy = spectrumValueHz(
    spectrum,
    nyquist,
    serpentinePosition(x, xRows, z, zRows),
    0, //routedNumber(params, routedParams, 'TopBottomHZRangeMin', 260),
    0, //routedNumber(params, routedParams, 'TopBottomHZRangeMax', 2500),
  );
  const energy = spectralEnergy * 1.25 + topBottomPulse * 0.15;

  return falloff * energy * audioDepth;
}

export function sideWallAnim(
  y: number,
  z: number,
  yRows: number,
  zRows: number,
  audioDepth: number,
  sidePulse: number,
  spectrum: number[],
  nyquist: number,
) {
  const fy = sineFalloff(y - 1, yRows - 2);
  const fz = sineFalloff(z - 1, zRows - 2);
  const falloff = (fy + fz) / 2;
  const spectralEnergy = spectrumValueHz(
    spectrum,
    nyquist,
    serpentinePosition(z, zRows, y, yRows),
    35,
    260,
  );
  const energy = spectralEnergy * 1.25 + sidePulse * 0.15;

  return falloff * energy * audioDepth;
}
