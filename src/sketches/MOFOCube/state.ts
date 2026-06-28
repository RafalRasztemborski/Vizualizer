import type { DupaState } from './types';

export const RENDER_SCALE = 1.0;

export const state: DupaState = {
  smoothedLeftRightPulse: 0,
  smoothedTopBottomPulse: 0,
  smoothedFrontBackPulse: 0,
  smoothedLeftRightSpectrum: [],
  smoothedTopBottomSpectrum: [],
  smoothedFrontBackSpectrum: [],
};

export function resetDupaRuntimeState() {
  state.smoothedLeftRightPulse = 0;
  state.smoothedTopBottomPulse = 0;
  state.smoothedFrontBackPulse = 0;
  state.smoothedLeftRightSpectrum = [];
  state.smoothedTopBottomSpectrum = [];
  state.smoothedFrontBackSpectrum = [];
}
