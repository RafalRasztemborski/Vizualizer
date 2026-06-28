import type p5 from 'p5';
import type { NumericRecord, SketchParams } from '../../core/types';

export type WallName = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

export type BoxColor = {
  hue: number;
  saturation: number;
  brightness: number;
  alpha: number;
  edgeAlpha: number;
};

export type DupaState = {
  trailShader?: p5.Shader;
  smoothedLeftRightPulse: number;
  smoothedTopBottomPulse: number;
  smoothedFrontBackPulse: number;
  smoothedLeftRightSpectrum: number[];
  smoothedTopBottomSpectrum: number[];
  smoothedFrontBackSpectrum: number[];
};

export type DrawWallsArgs = {
  p: p5;
  params: SketchParams;
  routedParams: NumericRecord;
  xRows: number;
  yRows: number;
  zRows: number;
  xSize: number;
  ySize: number;
  zSize: number;
  stepX: number;
  stepY: number;
  stepZ: number;
  totalWidth: number;
  totalHeight: number;
  totalDepth: number;
  audioDepth: number;
  sidePulse: number;
  topBottomPulse: number;
  frontBackPulse: number;
  spectrumLR: number[];
  spectrumTB: number[];
  spectrumFB: number[];
  nyquist: number;
  timeMs: number;
};
