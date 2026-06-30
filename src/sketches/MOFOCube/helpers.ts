import type p5 from 'p5';
import type { NumericRecord, RuntimeFrame, SketchParams } from '../../core/types';
import type { WallName } from './types';

const WALL_PARAM: Record<WallName, string> = {
  front: 'showFrontWall',
  back: 'showBackWall',
  left: 'showLeftWall',
  right: 'showRightWall',
  top: 'showTopWall',
  bottom: 'showBottomWall',
};

export function numberParam(params: SketchParams, key: string, fallback = 0) {
  const value = params[key];
  return typeof value === 'number' ? value : fallback;
}

export function routedNumber(
  params: SketchParams,
  routedParams: NumericRecord,
  key: string,
  fallback = 0,
) {
  return numberParam(params, key, fallback) + (routedParams[key] ?? 0);
}

export function boolParam(params: SketchParams, key: string, fallback = false) {
  const value = params[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function stringParam(params: SketchParams, key: string, fallback = '') {
  const value = params[key];
  return typeof value === 'string' ? value : fallback;
}

export function wallEnabled(params: SketchParams, wall: WallName) {
  return boolParam(params, WALL_PARAM[wall], true);
}

export function sineFalloff(index: number, count: number) {
  if (count <= 1) return 0;
  return Math.sin((index / (count - 1)) * Math.PI);
}

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function signalNumber(
  signals: RuntimeFrame['signals'],
  key: 'bass' | 'mid' | 'high' | 'kickEnergy',
  fallback = 0,
) {
  const value = signals[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function canvasSizeForHost(p: p5) {
  const host = ((p as any).canvas as HTMLCanvasElement | undefined)?.parentElement;
  return {
    width: Math.max(1, host?.clientWidth ?? p.windowWidth),
    height: Math.max(1, host?.clientHeight ?? p.windowHeight),
  };
}

export function smoothstep01(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function edgeSideWeight(
  index: number,
  count: number,
  side: 'min' | 'max',
  radius: number,
) {
  const innerCount = count - 2;
  if (innerCount <= 1) return 1;

  const innerIndex = index - 1;
  const distanceToEdge =
    side === 'min' ? innerIndex : innerCount - 1 - innerIndex;
  const distanceToCenter = Math.max(1, (innerCount - 1) / 2);
  const radiusScale = Math.max(0.01, radius);

  return 1 - smoothstep01(distanceToEdge / distanceToCenter / radiusScale);
}

export function spectrumValueHz(
  dataArray: number[],
  nyquist: number,
  position: number,
  lowHz: number,
  highHz: number,
) {
  if (!dataArray.length) return 0;

  const lowIndex = Math.floor(
    (Math.max(0, lowHz) / nyquist) * (dataArray.length - 1),
  );
  const highIndex = Math.ceil(
    (Math.min(nyquist, highHz) / nyquist) * (dataArray.length - 1),
  );
  const start = Math.max(0, Math.min(dataArray.length - 1, lowIndex));
  const end = Math.max(start, Math.min(dataArray.length - 1, highIndex));
  const index = Math.round(start + clamp01(position) * (end - start));
  const prev = dataArray[Math.max(start, index - 1)] ?? 0;
  const current = dataArray[index] ?? 0;
  const next = dataArray[Math.min(end, index + 1)] ?? 0;

  return (prev + current * 2 + next) / 4;
}

export function serpentinePosition(
  a: number,
  aCount: number,
  b: number,
  bCount: number,
) {
  const safeA = Math.max(1, aCount - 2);
  const safeB = Math.max(1, bCount - 2);
  const innerA = Math.max(0, Math.min(safeA - 1, a - 1));
  const innerB = Math.max(0, Math.min(safeB - 1, b - 1));
  const rowA = innerB % 2 === 0 ? innerA : safeA - 1 - innerA;
  const index = innerB * safeA + rowA;
  const maxIndex = Math.max(1, safeA * safeB - 1);

  return index / maxIndex;
}

export type WallLayoutStyle =
  | 'normal'
  | 'flipPrimary'
  | 'flipSecondary'
  | 'rotate180'
  | 'diagonalSwap'
  | 'checkerFlip'
  | 'centerFold';

function clampGridIndex(index: number, count: number) {
  return Math.max(1, Math.min(count - 2, Math.round(index)));
}

function mirrorIndex(index: number, count: number) {
  return count - 1 - index;
}

function normalizedInner(index: number, count: number) {
  const innerCount = Math.max(1, count - 2);
  return innerCount <= 1 ? 0 : (index - 1) / (innerCount - 1);
}

function denormalizedInner(value: number, count: number) {
  return 1 + clamp01(value) * Math.max(0, count - 3);
}

export function transformWallSample(
  primary: number,
  secondary: number,
  primaryCount: number,
  secondaryCount: number,
  style: WallLayoutStyle,
  mirror = false,
) {
  let a = primary;
  let b = secondary;

  if (mirror) {
    a = mirrorIndex(a, primaryCount);
    b = mirrorIndex(b, secondaryCount);
  }

  if (style === 'flipPrimary') {
    a = mirrorIndex(a, primaryCount);
  } else if (style === 'flipSecondary') {
    b = mirrorIndex(b, secondaryCount);
  } else if (style === 'rotate180') {
    a = mirrorIndex(a, primaryCount);
    b = mirrorIndex(b, secondaryCount);
  } else if (style === 'diagonalSwap') {
    const na = normalizedInner(a, primaryCount);
    const nb = normalizedInner(b, secondaryCount);
    a = denormalizedInner(nb, primaryCount);
    b = denormalizedInner(na, secondaryCount);
  } else if (style === 'checkerFlip') {
    if ((primary + secondary) % 2 === 0) {
      a = mirrorIndex(a, primaryCount);
    } else {
      b = mirrorIndex(b, secondaryCount);
    }
  } else if (style === 'centerFold') {
    const na = normalizedInner(a, primaryCount);
    const nb = normalizedInner(b, secondaryCount);
    const foldedA = na <= 0.5 ? na * 2 : (1 - na) * 2;
    const foldedB = nb <= 0.5 ? nb * 2 : (1 - nb) * 2;
    a = denormalizedInner(foldedA, primaryCount);
    b = denormalizedInner(foldedB, secondaryCount);
  }

  return {
    primary: clampGridIndex(a, primaryCount),
    secondary: clampGridIndex(b, secondaryCount),
  };
}

export function updateSmoothedSpectrum(
  current: number[],
  target: number[],
  smoothing: number,
) {
  if (current.length !== target.length) return [...target];
  for (let i = 0; i < target.length; i++) {
    current[i] += (target[i] - current[i]) * smoothing;
  }
  return current;
}
