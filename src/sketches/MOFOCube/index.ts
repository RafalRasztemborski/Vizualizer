import type { P5SketchModule, RuntimeFrame } from '../../core/types';
import { MOFO_CUBE_PARAMS } from './params';
import {
  clearWebglTrail,
  TRAIL_FRAGMENT_SHADER,
  TRAIL_VERTEX_SHADER,
} from './shaders';
import { RENDER_SCALE, resetDupaRuntimeState, state } from './state';
import {
  boolParam,
  canvasSizeForHost,
  clamp01,
  routedNumber,
  signalNumber,
  updateSmoothedSpectrum,
} from './helpers';
import { drawWalls } from './walls';

export const dupaSketch: P5SketchModule = {
  id: 'dupa',
  name: 'Dupa',
  description: 'Reaktywny tunel z szesciennych scian w WEBGL.',
  params: MOFO_CUBE_PARAMS,
  setup(p) {
    // Wyłączenie antialiasingu i prośba o wysoką wydajność GPU
    p.setAttributes({
      antialias: false,
      powerPreference: 'high-performance' as any,
    });

    resetDupaRuntimeState();

    const { width, height } = canvasSizeForHost(p);
    const cnv = p.createCanvas(
      width * RENDER_SCALE,
      height * RENDER_SCALE,
      p.WEBGL,
    );
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 255);
    state.trailShader = p.createShader(
      TRAIL_VERTEX_SHADER,
      TRAIL_FRAGMENT_SHADER,
    );

    // Wymuszenie skalowania CSS (100% zamiast vw/vh, aby nie zasłaniać UI)
    const canvasEl = (cnv as any).elt as HTMLCanvasElement;
    if (canvasEl) {
      canvasEl.style.width = '100%';
      canvasEl.style.height = '100%';
      canvasEl.style.imageRendering = 'pixelated'; // Zachowuje ostrość przy upscalingu
      canvasEl.style.transform = 'translateZ(0)'; // Wymusza oddzielną warstwę kompozytora
    }

    p.perspective();
  },
  draw(frame) {
    drawDupa(frame);
  },
  windowResized(p) {
    const { width, height } = canvasSizeForHost(p);
    p.resizeCanvas(width * RENDER_SCALE, height * RENDER_SCALE);
    const canvasEl = (p as any).canvas as HTMLCanvasElement;
    if (canvasEl) {
      canvasEl.style.width = '100%';
      canvasEl.style.height = '100%';
    }
    p.perspective();
  },
  dispose() {
    state.trailShader = undefined;
    resetDupaRuntimeState();
  },
};

export function drawDupa({ p, params, routedParams, signals, timeMs }: RuntimeFrame) {
  const bass = signalNumber(signals, 'bass');
  const mid = signalNumber(signals, 'mid');
  const high = signalNumber(signals, 'high');
  const kickEnergy = signalNumber(signals, 'kickEnergy');
  const nyquist =
    typeof signals.nyquist === 'number' && Number.isFinite(signals.nyquist)
      ? signals.nyquist
      : 22050;

  if (!Number.isFinite(state.smoothedLeftRightPulse)) {
    resetDupaRuntimeState();
  }

  clearWebglTrail(
    p,
    Math.max(
      0,
      Math.min(255, routedNumber(params, routedParams, 'trailAlpha', 80)),
    ),
    params.trailMode ?? 'solid',
    clamp01(routedNumber(params, routedParams, 'scanlineAmount', 0.35)),
    Math.max(0.01, routedNumber(params, routedParams, 'scanlineCount', 0.48)),
    timeMs,
  );

  const xSize = Math.max(1, routedNumber(params, routedParams, 'X_SIZE', 20));
  const ySize = Math.max(1, routedNumber(params, routedParams, 'Y_SIZE', 20));
  const zSize = Math.max(1, routedNumber(params, routedParams, 'Z_SIZE', 20));

  const xRows = Math.max(
    2,
    Math.round(routedNumber(params, routedParams, 'X_ROWS', 10)),
  );
  const yRows = Math.max(
    2,
    Math.round(routedNumber(params, routedParams, 'Y_ROWS', 10)),
  );
  const zRows = Math.max(
    2,
    Math.round(routedNumber(params, routedParams, 'Z_ROWS', 10)),
  );

  const xGap = Math.max(0, routedNumber(params, routedParams, 'X_GAP', 0));
  const yGap = Math.max(0, routedNumber(params, routedParams, 'Y_GAP', 0));
  const zGap = Math.max(0, routedNumber(params, routedParams, 'Z_GAP', 0));

  const audioDepth = Math.max(
    0,
    routedNumber(params, routedParams, 'audioDepth', 120),
  );

  const stepX = xSize + xGap;
  const stepY = ySize + yGap;
  const stepZ = zSize + zGap;
  const totalWidth = xRows * stepX;
  const totalHeight = yRows * stepY;
  const totalDepth = zRows * stepZ;
  const t = timeMs * 0.001;

  const rotationSpeed = routedNumber(params, routedParams, 'rotationSpeed', 1);
  const autoRotX = boolParam(params, 'autoRotateX', false)
    ? t * rotationSpeed
    : 0;
  const autoRotY = boolParam(params, 'autoRotateY', false)
    ? t * rotationSpeed
    : 0;
  const autoRotZ = boolParam(params, 'autoRotateZ', false)
    ? t * rotationSpeed
    : 0;

  const psLR = clamp01(routedNumber(params, routedParams, 'pulseSmLR', 0.39));
  const ssLR = clamp01(
    routedNumber(params, routedParams, 'spectrumSmLR', 0.24),
  );
  const psTB = clamp01(routedNumber(params, routedParams, 'pulseSmTB', 0.78));
  const ssTB = clamp01(
    routedNumber(params, routedParams, 'spectrumSmTB', 0.37),
  );
  const psFB = clamp01(routedNumber(params, routedParams, 'pulseSmFB', 0.15));
  const ssFB = clamp01(routedNumber(params, routedParams, 'spectrumSmFB', 0.1));

  const targetSidePulse =
    (bass * 0.75 + kickEnergy * 1.8) *
    routedNumber(params, routedParams, 'sidePulseMult', 1);
  const targetTopBottomPulse =
    mid * routedNumber(params, routedParams, 'topBottomPulseMult', 1);
  const targetFrontBackPulse =
    high * routedNumber(params, routedParams, 'frontBackPulseMult', 1);

  // Aplikacja wygładzania dla impulsów
  state.smoothedLeftRightPulse +=
    (targetSidePulse - state.smoothedLeftRightPulse) * psLR;
  state.smoothedTopBottomPulse +=
    (targetTopBottomPulse - state.smoothedTopBottomPulse) * psTB;
  state.smoothedFrontBackPulse +=
    (targetFrontBackPulse - state.smoothedFrontBackPulse) * psFB;

  // Wygładzanie całego widma (używane przez boxy do indywidualnych ruchów)
  const spectrum = signals.dataArray;
  state.smoothedLeftRightSpectrum = updateSmoothedSpectrum(
    state.smoothedLeftRightSpectrum,
    spectrum,
    ssLR,
  );
  state.smoothedTopBottomSpectrum = updateSmoothedSpectrum(
    state.smoothedTopBottomSpectrum,
    spectrum,
    ssTB,
  );
  state.smoothedFrontBackSpectrum = updateSmoothedSpectrum(
    state.smoothedFrontBackSpectrum,
    spectrum,
    ssFB,
  );

  const sidePulse = state.smoothedLeftRightPulse;
  const topBottomPulse = state.smoothedTopBottomPulse;
  const frontBackPulse = state.smoothedFrontBackPulse;
  const spectrumLR = state.smoothedLeftRightSpectrum;
  const spectrumTB = state.smoothedTopBottomSpectrum;
  const spectrumFB = state.smoothedFrontBackSpectrum;

  const edgeWeight = Math.max(
    0,
    routedNumber(params, routedParams, 'edgeWeight', 1),
  );

  p.push();
  p.translate(0, 0, routedNumber(params, routedParams, 'z_position', 0));
  p.rotateX(
    p.radians(routedNumber(params, routedParams, 'X_ROTATE', 0)) +
    autoRotX +
    Math.sin(t * 0.4) * high * 0.55,
  );
  p.rotateY(
    p.radians(routedNumber(params, routedParams, 'Y_ROTATE', 0)) +
    autoRotY +
    Math.sin(t * 0.35) * bass * 0.25,
  );
  p.rotateZ(
    p.radians(routedNumber(params, routedParams, 'Z_ROTATE', 0)) + autoRotZ,
  );

  p.ambientLight(0, 0, 24 + mid * 18);
  p.directionalLight(0, 0, 96, -0.35, 0.45, -1);
  p.pointLight(
    (routedNumber(params, routedParams, 'hue', 142) + 40) % 360,
    80,
    100,
    0,
    -220,
    260,
  );
  p.strokeWeight(edgeWeight);
  if (edgeWeight <= 0) {
    p.noStroke();
  }

  drawWalls({
    p,
    params,
    routedParams,
    xRows,
    yRows,
    zRows,
    xSize,
    ySize,
    zSize,
    stepX,
    stepY,
    stepZ,
    totalWidth,
    totalHeight,
    totalDepth,
    audioDepth,
    sidePulse,
    topBottomPulse,
    frontBackPulse,
    spectrumLR,
    spectrumTB,
    spectrumFB,
    nyquist,
    timeMs,
  });

  p.pop();
}

