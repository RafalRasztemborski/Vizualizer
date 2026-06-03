import type p5 from 'p5';
import type {
  NumericRecord,
  P5SketchModule,
  RuntimeFrame,
  SketchParams,
} from '../core/types';

type WallName = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

type BoxColor = {
  hue: number;
  saturation: number;
  brightness: number;
  alpha: number;
  edgeAlpha: number;
};

type DupaState = {
  trailShader?: p5.Shader;
};

const WALL_PARAM: Record<WallName, string> = {
  front: 'showFrontWall',
  back: 'showBackWall',
  left: 'showLeftWall',
  right: 'showRightWall',
  top: 'showTopWall',
  bottom: 'showBottomWall',
};

const TRAIL_VERTEX_SHADER = `
precision mediump float;

attribute vec3 aPosition;

void main() {
  gl_Position = vec4(aPosition.xy, 0.0, 1.0);
}
`;

const TRAIL_FRAGMENT_SHADER = `
precision mediump float;

uniform float uAlpha;
uniform float uScanlineAmount;
uniform float uScanlineCount;
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uTopColor;
uniform vec3 uBottomColor;

void main() {
  float y = clamp(gl_FragCoord.y / max(uResolution.y, 1.0), 0.0, 1.0);
  vec3 color = mix(uBottomColor, uTopColor, y);
  float scan = sin((gl_FragCoord.y + uTime * 24.0) * uScanlineCount);
  float scanMask = mix(1.0, 0.58 + 0.42 * smoothstep(-0.2, 0.75, scan), uScanlineAmount);
  color *= scanMask;
  gl_FragColor = vec4(color, uAlpha);
}
`;

const state: DupaState = {};
const RENDER_SCALE = 0.7;

function numberParam(params: SketchParams, key: string, fallback = 0) {
  const value = params[key];
  return typeof value === 'number' ? value : fallback;
}

function routedNumber(
  params: SketchParams,
  routedParams: NumericRecord,
  key: string,
  fallback = 0,
) {
  return numberParam(params, key, fallback) + (routedParams[key] ?? 0);
}

function boolParam(params: SketchParams, key: string, fallback = false) {
  const value = params[key];
  return typeof value === 'boolean' ? value : fallback;
}

function wallEnabled(params: SketchParams, wall: WallName) {
  return boolParam(params, WALL_PARAM[wall], true);
}

function clearWebglTrail(
  p: p5,
  alpha: number,
  mode: SketchParams[string],
  scanlineAmount: number,
  scanlineCount: number,
  timeMs: number,
) {
  const gl = p.drawingContext as WebGLRenderingContext;

  p.push();
  p.resetMatrix();
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  p.noStroke();

  if (mode === 'gradient' && state.trailShader) {
    p.shader(state.trailShader);
    state.trailShader.setUniform('uAlpha', clamp01(alpha / 255));
    state.trailShader.setUniform('uScanlineAmount', scanlineAmount);
    state.trailShader.setUniform('uScanlineCount', scanlineCount);
    state.trailShader.setUniform('uTime', timeMs * 0.001);
    state.trailShader.setUniform('uResolution', [p.width, p.height]);
    state.trailShader.setUniform('uTopColor', [5 / 255, 10 / 255, 30 / 255]);
    state.trailShader.setUniform('uBottomColor', [0, 0, 0]);

    p.beginShape();
    p.vertex(-1, -1, 0);
    p.vertex(1, -1, 0);
    p.vertex(1, 1, 0);
    p.vertex(-1, 1, 0);
    p.endShape(p.CLOSE);
    p.resetShader();
  } else {
    p.fill(0, 0, 0, alpha);
    p.rect(-p.width / 2, -p.height / 2, p.width, p.height);
  }

  gl.enable(gl.DEPTH_TEST);
  p.pop();
}

function sineFalloff(index: number, count: number) {
  if (count <= 1) return 0;
  return Math.sin((index / (count - 1)) * Math.PI);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep01(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function edgeSideWeight(
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

function spectrumValueHz(
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

function serpentinePosition(
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

function drawBox(
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

function colorForBox(
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

export const dupaSketch: P5SketchModule = {
  id: 'dupa',
  name: 'Dupa',
  description: 'Reaktywny tunel z szesciennych scian w WEBGL.',
  params: [
    // --- SEKCJA 1: POZYCJA I ORIENTACJA ---
    {
      key: 'z_position',
      label: 'Tunnel Z Pos',
      type: 'number',
      min: -2000,
      max: 800,
      step: 1,
      defaultValue: 0,
    },
    {
      key: 'Crazy_z_position',
      label: 'Z Warp (Crazy)',
      type: 'number',
      min: -50,
      max: 50,
      step: 1,
      defaultValue: 0,
    },
    {
      key: 'rotationSpeed',
      label: 'Auto-Rot Speed',
      type: 'number',
      min: 0,
      max: 10,
      step: 0.1,
      defaultValue: 1,
    },
    {
      key: 'autoRotateX',
      label: 'Auto Rotate X',
      type: 'boolean',
      defaultValue: false,
    },
    {
      key: 'autoRotateY',
      label: 'Auto Rotate Y',
      type: 'boolean',
      defaultValue: false,
    },
    {
      key: 'autoRotateZ',
      label: 'Auto Rotate Z',
      type: 'boolean',
      defaultValue: false,
    },
    // --- SEKCJA 2: GEOMETRIA SIATKI (GRID) ---
    {
      key: 'X_SIZE',
      label: 'X size',
      type: 'number',
      min: 1,
      max: 100,
      step: 1,
      defaultValue: 20,
    },
    {
      key: 'Y_SIZE',
      label: 'Y size',
      type: 'number',
      min: 1,
      max: 100,
      step: 1,
      defaultValue: 20,
    },
    {
      key: 'Z_SIZE',
      label: 'Z size',
      type: 'number',
      min: 1,
      max: 500,
      step: 1,
      defaultValue: 20,
    },

    {
      key: 'X_ROWS',
      label: 'X rows',
      type: 'number',
      min: 2,
      max: 35,
      step: 1,
      defaultValue: 10,
    },
    {
      key: 'Y_ROWS',
      label: 'Y rows',
      type: 'number',
      min: 2,
      max: 35,
      step: 1,
      defaultValue: 10,
    },
    {
      key: 'Z_ROWS',
      label: 'Z rows',
      type: 'number',
      min: 2,
      max: 35,
      step: 1,
      defaultValue: 10,
    },

    {
      key: 'X_GAP',
      label: 'X gap',
      type: 'number',
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 1,
    },
    {
      key: 'Y_GAP',
      label: 'Y gap',
      type: 'number',
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 1,
    },
    {
      key: 'Z_GAP',
      label: 'Z gap',
      type: 'number',
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 1,
    },

    {
      key: 'X_ROTATE',
      label: 'X rotate',
      type: 'number',
      min: 0,
      max: 360,
      step: 1,
      defaultValue: 0,
    },
    {
      key: 'Y_ROTATE',
      label: 'Y rotate',
      type: 'number',
      min: 0,
      max: 360,
      step: 1,
      defaultValue: 0,
    },
    {
      key: 'Z_ROTATE',
      label: 'Z rotate',
      type: 'number',
      min: 0,
      max: 360,
      step: 1,
      defaultValue: 0,
    },
    // --- SEKCJA 3: WIDOCZNOŚĆ ŚCIAN ---
    {
      key: 'showFrontWall',
      label: 'Front wall',
      type: 'boolean',
      defaultValue: true,
    },
    {
      key: 'showBackWall',
      label: 'Back wall',
      type: 'boolean',
      defaultValue: true,
    },
    {
      key: 'showLeftWall',
      label: 'Left wall',
      type: 'boolean',
      defaultValue: true,
    },
    {
      key: 'showRightWall',
      label: 'Right wall',
      type: 'boolean',
      defaultValue: true,
    },
    {
      key: 'showTopWall',
      label: 'Top wall',
      type: 'boolean',
      defaultValue: true,
    },
    {
      key: 'showBottomWall',
      label: 'Bottom wall',
      type: 'boolean',
      defaultValue: true,
    },
    // --- SEKCJA 4: REAKTYWNOŚĆ AUDIO ---
    {
      key: 'audioDepth',
      label: 'Audio intensity',
      type: 'number',
      min: 0,
      max: 500,
      step: 1,
      defaultValue: 90,
    },
    {
      key: 'sidePulseMult',
      label: 'Pulse Mult: Sides',
      type: 'number',
      min: 0,
      max: 5,
      step: 0.1,
      defaultValue: 1,
    },
    {
      key: 'topBottomPulseMult',
      label: 'Pulse Mult: T/B',
      type: 'number',
      min: 0,
      max: 5,
      step: 0.1,
      defaultValue: 1,
    },
    {
      key: 'frontBackPulseMult',
      label: 'Pulse Mult: F/B',
      type: 'number',
      min: 0,
      max: 5,
      step: 0.1,
      defaultValue: 1,
    },
    // --- SEKCJA 5: KOLORY I ŚWIATŁO ---
    {
      key: 'trailAlpha',
      label: 'Trail alpha',
      type: 'number',
      min: 8,
      max: 255,
      step: 1,
      defaultValue: 255,
    },
    {
      key: 'trailMode',
      label: 'Trail mode',
      type: 'select',
      options: ['solid', 'gradient'],
      defaultValue: 'solid',
    },
    {
      key: 'scanlineAmount',
      label: 'Scanline amount',
      type: 'number',
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.35,
    },
    {
      key: 'scanlineCount',
      label: 'Scanline count',
      type: 'number',
      min: 0.05,
      max: 1.5,
      step: 0.01,
      defaultValue: 0.48,
    },
    {
      key: 'dynamicLight',
      label: 'Dynamic light',
      type: 'boolean',
      defaultValue: false,
    },
    {
      key: 'hue',
      label: 'Hue',
      type: 'number',
      min: 0,
      max: 360,
      step: 1,
      defaultValue: 216,
    },
    {
      key: 'colorSpread',
      label: 'Color spread',
      type: 'number',
      min: 0,
      max: 360,
      step: 1,
      defaultValue: 18,
    },
    {
      key: 'saturation',
      label: 'Saturation',
      type: 'number',
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 68,
    },
    {
      key: 'brightness',
      label: 'Brightness',
      type: 'number',
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 96,
    },
    {
      key: 'opacity',
      label: 'Opacity',
      type: 'number',
      min: 0,
      max: 255,
      step: 1,
      defaultValue: 255,
    },
    // --- SEKCJA 6: KRAWĘDZIE I WYRÓWNANIE ---
    {
      key: 'edgeWeight',
      label: 'Edge weight',
      type: 'number',
      min: 0,
      max: 4,
      step: 0.1,
      defaultValue: 1,
    },
    {
      key: 'edgeAlpha',
      label: 'Edge alpha',
      type: 'number',
      min: 0,
      max: 255,
      step: 1,
      defaultValue: 230,
    },
    {
      key: 'frontBackEdgeAlign',
      label: 'F/B edge align',
      type: 'boolean',
      defaultValue: false,
    },
    {
      key: 'frontBackEdgeAlignAmount',
      label: 'F/B align amount',
      type: 'number',
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.8,
    },
    {
      key: 'frontBackEdgeAlignRadius',
      label: 'F/B align radius',
      type: 'number',
      min: 0.05,
      max: 1,
      step: 0.01,
      defaultValue: 0.75,
    },
    {
      key: 'leftRightEdgeAlign',
      label: 'L/R edge align',
      type: 'boolean',
      defaultValue: false,
    },
    {
      key: 'leftRightEdgeAlignAmount',
      label: 'L/R align amount',
      type: 'number',
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.8,
    },
    {
      key: 'leftRightEdgeAlignRadius',
      label: 'L/R align radius',
      type: 'number',
      min: 0.05,
      max: 1,
      step: 0.01,
      defaultValue: 0.75,
    },
    {
      key: 'topBottomEdgeAlign',
      label: 'T/B edge align',
      type: 'boolean',
      defaultValue: false,
    },
    {
      key: 'topBottomEdgeAlignAmount',
      label: 'T/B align amount',
      type: 'number',
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.8,
    },
    {
      key: 'topBottomEdgeAlignRadius',
      label: 'T/B align radius',
      type: 'number',
      min: 0.05,
      max: 1,
      step: 0.01,
      defaultValue: 0.75,
    },
    // --- SEKCJA 7: ARCH STRENGTH (FORMUŁY) ---
    {
      key: 'frontBackArch',
      label: 'F/B Arch Strength',
      type: 'number',
      min: -4,
      max: 4,
      step: 0.01,
      defaultValue: 1.5,
    },
    {
      key: 'frontBackWallPower',
      label: 'F/B Wall Power',
      type: 'number',
      min: 0,
      max: 4,
      step: 0.01,
      defaultValue: 1,
    },
    {
      key: 'leftRightArch',
      label: 'L/R Arch Strength',
      type: 'number',
      min: -4,
      max: 4,
      step: 0.01,
      defaultValue: 0.5,
    },
    {
      key: 'leftRightWallPower',
      label: 'L/R Wall Power',
      type: 'number',
      min: 0,
      max: 4,
      step: 0.01,
      defaultValue: 1,
    },
    {
      key: 'topBottomArch',
      label: 'T/B Arch Strength',
      type: 'number',
      min: -4,
      max: 4,
      step: 0.01,
      defaultValue: 0.5,
    },
    {
      key: 'topBottomWallPower',
      label: 'T/B Wall Power',
      type: 'number',
      min: 0,
      max: 4,
      step: 0.01,
      defaultValue: 1,
    },
  ],
  setup(p) {
    // Wyłączenie antialiasingu i prośba o wysoką wydajność GPU
    p.setAttributes({
      antialias: false,
      powerPreference: 'high-performance' as any,
    });

    // Skalowanie rozdzielczości (0.5 = 25% pikseli do przeliczenia)
    const cnv = p.createCanvas(
      p.windowWidth * RENDER_SCALE,
      p.windowHeight * RENDER_SCALE,
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
  },
  draw(frame) {
    drawDupa(frame);
  },
  windowResized(p) {
    p.resizeCanvas(p.windowWidth * RENDER_SCALE, p.windowHeight * RENDER_SCALE);
    const canvasEl = (p as any).canvas as HTMLCanvasElement;
    if (canvasEl) {
      canvasEl.style.width = '100%';
      canvasEl.style.height = '100%';
    }
  },
};

function drawDupa({ p, params, routedParams, signals, timeMs }: RuntimeFrame) {
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
    routedNumber(params, routedParams, 'audioDepth', 140),
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

  const sidePulse =
    (signals.bass * 0.75 + signals.kickEnergy * 1.8) *
    routedNumber(params, routedParams, 'sidePulseMult', 1);
  const topBottomPulse =
    signals.mid * routedNumber(params, routedParams, 'topBottomPulseMult', 1);
  const frontBackPulse =
    signals.high * routedNumber(params, routedParams, 'frontBackPulseMult', 1);
  const spectrum = signals.dataArray;
  const nyquist = signals.nyquist;
  const edgeWeight = Math.max(
    0,
    routedNumber(params, routedParams, 'edgeWeight', 1),
  );

  p.push();
  // Kompensacja "zoomu" wynikającego ze zmniejszenia canvasu.
  // Skalujemy cały świat o RENDER_SCALE, aby obiekty miały taki sam rozmiar
  // na ekranie jak przy pełnej rozdzielczości.
  p.scale(RENDER_SCALE);
  p.translate(0, 0, routedNumber(params, routedParams, 'z_position', 0));
  p.rotateX(
    p.radians(routedNumber(params, routedParams, 'X_ROTATE', 0)) +
      autoRotX +
      Math.sin(t * 0.4) * signals.high * 0.25,
  );
  p.rotateY(
    p.radians(routedNumber(params, routedParams, 'Y_ROTATE', 0)) +
      autoRotY +
      Math.sin(t * 0.35) * signals.bass * 0.25,
  );
  p.rotateZ(p.radians(routedNumber(params, routedParams, 'Z_ROTATE', 0)));
  p.rotateZ(
    p.radians(routedNumber(params, routedParams, 'Z_ROTATE', 0)) + autoRotZ,
  );

  p.ambientLight(0, 0, 24 + signals.mid * 18);
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
    spectrum,
    nyquist,
    timeMs,
  });

  p.pop();
}

type DrawWallsArgs = {
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
  spectrum: number[];
  nyquist: number;
  timeMs: number;
};

function drawWalls(args: DrawWallsArgs) {
  drawFrontBackWalls(args);
  drawLeftRightWalls(args);
  drawTopBottomWalls(args);
}

function drawFrontBackWalls({
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
  spectrum,
  nyquist,
  timeMs,
}: DrawWallsArgs) {
  const edgeAlignEnabled = boolParam(params, 'frontBackEdgeAlign', false);
  const edgeAlignAmount = clamp01(
    routedNumber(params, routedParams, 'frontBackEdgeAlignAmount', 0.8),
  );
  const edgeAlignRadius = Math.max(
    0.05,
    routedNumber(params, routedParams, 'frontBackEdgeAlignRadius', 0.75),
  );

  for (let x = 1; x < xRows - 1; x += 1) {
    const falloffX = sineFalloff(x - 1, xRows - 2);

    for (let y = 1; y < yRows - 1; y += 1) {
      const falloffY = sineFalloff(y - 1, yRows - 2);
      const falloff = (falloffX + falloffY) / 2; // Średnia, aby tylko rogi (0,0) były nieruchome
      const spectralEnergy = spectrumValueHz(
        spectrum,
        nyquist,
        serpentinePosition(x, xRows, y, yRows),
        2500,
        12000,
      );
      const energy = spectralEnergy * 1.25 + frontBackPulse * 0.15;
      const anim = falloff * energy * audioDepth;
      const px = -totalWidth / 2 + x * stepX + stepX / 2;
      const py = totalHeight / 2 - y * stepY - stepY / 2;
      const archStrength = routedNumber(
        params,
        routedParams,
        'frontBackArch',
        1.5,
      );
      const wallPower = Math.max(
        0,
        routedNumber(params, routedParams, 'frontBackWallPower', 1),
      );
      const { startOffset, sizeAdd } = wallMotion(
        anim,
        archStrength,
        wallPower,
        falloff,
        falloffX * falloffY,
        stepZ,
      );
      const edgeAlign = edgeAlignEnabled
        ? frontBackEdgeAlignment({
            params,
            routedParams,
            x,
            y,
            xRows,
            yRows,
            zRows,
            audioDepth,
            sidePulse,
            topBottomPulse,
            spectrum,
            nyquist,
            amount: edgeAlignAmount,
            radius: edgeAlignRadius,
          })
        : { front: { x: 0, y: 0 }, back: { x: 0, y: 0 } };

      if (wallEnabled(params, 'front')) {
        const pz = -totalDepth / 2 + stepZ / 2 - startOffset - sizeAdd / 2;

        drawBox(
          p,
          px + edgeAlign.front.x,
          py + edgeAlign.front.y,
          pz,
          xSize,
          ySize,
          zSize + sizeAdd,
          colorForBox(params, routedParams, 'front', falloff, energy, timeMs),
        );
      }

      if (wallEnabled(params, 'back')) {
        const pz = totalDepth / 2 - stepZ / 2 + startOffset + sizeAdd / 2;

        drawBox(
          p,
          px + edgeAlign.back.x,
          py + edgeAlign.back.y,
          pz,
          xSize,
          ySize,
          zSize + sizeAdd,
          colorForBox(params, routedParams, 'back', falloff, energy, timeMs),
        );
      }
    }
  }
}

type FrontBackEdgeAlignmentArgs = {
  params: SketchParams;
  routedParams: NumericRecord;
  x: number;
  y: number;
  xRows: number;
  yRows: number;
  zRows: number;
  audioDepth: number;
  sidePulse: number;
  topBottomPulse: number;
  spectrum: number[];
  nyquist: number;
  amount: number;
  radius: number;
};

function frontBackEdgeAlignment(args: FrontBackEdgeAlignmentArgs) {
  return {
    front: frontBackEdgeAlignmentForZ({ ...args, z: 1 }),
    back: frontBackEdgeAlignmentForZ({ ...args, z: args.zRows - 2 }),
  };
}

function frontBackEdgeAlignmentForZ({
  params,
  routedParams,
  x,
  y,
  xRows,
  yRows,
  zRows,
  z,
  audioDepth,
  sidePulse,
  topBottomPulse,
  spectrum,
  nyquist,
  amount,
  radius,
}: FrontBackEdgeAlignmentArgs & { z: number }) {
  const topWeight = edgeSideWeight(y, yRows, 'min', radius);
  const bottomWeight = edgeSideWeight(y, yRows, 'max', radius);
  const leftWeight = edgeSideWeight(x, xRows, 'min', radius);
  const rightWeight = edgeSideWeight(x, xRows, 'max', radius);

  const topBottomStrength = routedNumber(
    params,
    routedParams,
    'topBottomArch',
    0.5,
  );
  const leftRightStrength = routedNumber(
    params,
    routedParams,
    'leftRightArch',
    0.5,
  );

  const topOffset = wallEnabled(params, 'top')
    ? wallEdgeOffset(
        topBottomStrength,
        'positive',
        topBottomWallAnim(
          x,
          z,
          xRows,
          zRows,
          audioDepth,
          topBottomPulse,
          spectrum,
          nyquist,
        ),
      )
    : 0;
  const bottomOffset = wallEnabled(params, 'bottom')
    ? wallEdgeOffset(
        topBottomStrength,
        'negative',
        topBottomWallAnim(
          x,
          z,
          xRows,
          zRows,
          audioDepth,
          topBottomPulse,
          spectrum,
          nyquist,
        ),
      )
    : 0;
  const leftOffset = wallEnabled(params, 'left')
    ? wallEdgeOffset(
        leftRightStrength,
        'negative',
        sideWallAnim(
          y,
          z,
          yRows,
          zRows,
          audioDepth,
          sidePulse,
          spectrum,
          nyquist,
        ),
      )
    : 0;
  const rightOffset = wallEnabled(params, 'right')
    ? wallEdgeOffset(
        leftRightStrength,
        'positive',
        sideWallAnim(
          y,
          z,
          yRows,
          zRows,
          audioDepth,
          sidePulse,
          spectrum,
          nyquist,
        ),
      )
    : 0;

  return {
    x: (leftOffset * leftWeight + rightOffset * rightWeight) * amount,
    y: (topOffset * topWeight + bottomOffset * bottomWeight) * amount,
  };
}

function wallEdgeOffset(
  strength: number,
  direction: 'negative' | 'positive',
  anim: number,
) {
  return (
    (direction === 'positive' ? 1 : -1) *
    anim *
    (0.5 + Math.max(0, strength))
  );
}

function wallMotion(
  anim: number,
  archStrength: number,
  wallPower: number,
  falloff: number,
  centerPowerMask: number,
  step: number,
) {
  const negativeArchMask = clamp01(-archStrength / 4);
  const powerSpreadMask =
    1 - negativeArchMask + centerPowerMask * negativeArchMask;
  const effectiveWallPower = wallPower * powerSpreadMask;
  const bounceOffset = anim * 0.5 * powerSpreadMask;

  return {
    startOffset: falloff * archStrength * step + bounceOffset,
    sizeAdd: Math.abs(anim) * effectiveWallPower,
  };
}

function frontBackWallAnim(
  x: number,
  y: number,
  xRows: number,
  yRows: number,
  audioDepth: number,
  frontBackPulse: number,
  spectrum: number[],
  nyquist: number,
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

function topBottomWallAnim(
  x: number,
  z: number,
  xRows: number,
  zRows: number,
  audioDepth: number,
  topBottomPulse: number,
  spectrum: number[],
  nyquist: number,
) {
  const fx = sineFalloff(x - 1, xRows - 2);
  const fz = sineFalloff(z - 1, zRows - 2);
  const falloff = (fx + fz) / 2;
  const spectralEnergy = spectrumValueHz(
    spectrum,
    nyquist,
    serpentinePosition(x, xRows, z, zRows),
    260,
    2500,
  );
  const energy = spectralEnergy * 1.25 + topBottomPulse * 0.15;

  return falloff * energy * audioDepth;
}

function sideWallAnim(
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

function drawLeftRightWalls({
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
  spectrum,
  nyquist,
  timeMs,
}: DrawWallsArgs) {
  const crazyZ =
    routedNumber(params, routedParams, 'Crazy_z_position', 0) / 100;
  const edgeAlignEnabled = boolParam(params, 'leftRightEdgeAlign', false);
  const edgeAlignAmount = clamp01(
    routedNumber(params, routedParams, 'leftRightEdgeAlignAmount', 0.8),
  );
  const edgeAlignRadius = Math.max(
    0.05,
    routedNumber(params, routedParams, 'leftRightEdgeAlignRadius', 0.75),
  );

  for (let y = 1; y < yRows - 1; y += 1) {
    const falloffY = sineFalloff(y - 1, yRows - 2);

    for (let z = 1; z < zRows - 1; z += 1) {
      const falloffZ = sineFalloff(z - 1, zRows - 2);
      const falloff = (falloffY + falloffZ) / 2;

      const spectralEnergy = spectrumValueHz(
        spectrum,
        nyquist,
        serpentinePosition(z, zRows, y, yRows),
        35,
        260,
      );
      const energy = spectralEnergy * 1.25 + sidePulse * 0.15;
      const anim = falloff * energy * audioDepth;
      const py = totalHeight / 2 - y * stepY - stepY / 2;
      const pz = -totalDepth / 2 + z * stepZ + stepZ / 2;
      const warpedZ = pz + pz * crazyZ;
      const archStrength = routedNumber(
        params,
        routedParams,
        'leftRightArch',
        0.5,
      );
      const wallPower = Math.max(
        0,
        routedNumber(params, routedParams, 'leftRightWallPower', 1),
      );
      const { startOffset, sizeAdd } = wallMotion(
        anim,
        archStrength,
        wallPower,
        falloff,
        falloffY * falloffZ,
        stepX,
      );

      const edgeAlign = edgeAlignEnabled
        ? leftRightEdgeAlignment({
            params,
            routedParams,
            xRows,
            y,
            z,
            yRows,
            zRows,
            audioDepth,
            topBottomPulse,
            frontBackPulse,
            spectrum,
            nyquist,
            amount: edgeAlignAmount,
            radius: edgeAlignRadius,
          })
        : { left: { y: 0, z: 0 }, right: { y: 0, z: 0 } };

      if (wallEnabled(params, 'left')) {
        const px = -totalWidth / 2 + stepX / 2 - startOffset - sizeAdd / 2;

        drawBox(
          p,
          px,
          py + edgeAlign.left.y,
          warpedZ + edgeAlign.left.z,
          xSize + sizeAdd,
          ySize,
          zSize,
          colorForBox(params, routedParams, 'left', falloff, energy, timeMs),
        );
      }

      if (wallEnabled(params, 'right')) {
        const px = totalWidth / 2 - stepX / 2 + startOffset + sizeAdd / 2;

        drawBox(
          p,
          px,
          py + edgeAlign.right.y,
          warpedZ + edgeAlign.right.z,
          xSize + sizeAdd,
          ySize,
          zSize,
          colorForBox(params, routedParams, 'right', falloff, energy, timeMs),
        );
      }
    }
  }
}

type LeftRightEdgeAlignmentArgs = {
  params: SketchParams;
  routedParams: NumericRecord;
  xRows: number;
  y: number;
  z: number;
  yRows: number;
  zRows: number;
  audioDepth: number;
  topBottomPulse: number;
  frontBackPulse: number;
  spectrum: number[];
  nyquist: number;
  amount: number;
  radius: number;
};

function leftRightEdgeAlignment(args: LeftRightEdgeAlignmentArgs) {
  return {
    left: leftRightEdgeAlignmentForX({ ...args, x: 1 }),
    right: leftRightEdgeAlignmentForX({ ...args, x: args.xRows - 2 }),
  };
}

function leftRightEdgeAlignmentForX({
  params,
  routedParams,
  x,
  y,
  z,
  xRows,
  yRows,
  zRows,
  audioDepth,
  topBottomPulse,
  frontBackPulse,
  spectrum,
  nyquist,
  amount,
  radius,
}: LeftRightEdgeAlignmentArgs & { x: number }) {
  const topWeight = edgeSideWeight(y, yRows, 'min', radius);
  const bottomWeight = edgeSideWeight(y, yRows, 'max', radius);
  const frontWeight = edgeSideWeight(z, zRows, 'min', radius);
  const backWeight = edgeSideWeight(z, zRows, 'max', radius);

  const topBottomStrength = routedNumber(
    params,
    routedParams,
    'topBottomArch',
    0.5,
  );
  const frontBackStrength = routedNumber(
    params,
    routedParams,
    'frontBackArch',
    1.5,
  );

  const topOffset = wallEnabled(params, 'top')
    ? wallEdgeOffset(
        topBottomStrength,
        'positive',
        topBottomWallAnim(
          x,
          z,
          xRows,
          zRows,
          audioDepth,
          topBottomPulse,
          spectrum,
          nyquist,
        ),
      )
    : 0;
  const bottomOffset = wallEnabled(params, 'bottom')
    ? wallEdgeOffset(
        topBottomStrength,
        'negative',
        topBottomWallAnim(
          x,
          z,
          xRows,
          zRows,
          audioDepth,
          topBottomPulse,
          spectrum,
          nyquist,
        ),
      )
    : 0;
  const frontOffset = wallEnabled(params, 'front')
    ? wallEdgeOffset(
        frontBackStrength,
        'negative',
        frontBackWallAnim(
          x,
          y,
          xRows,
          yRows,
          audioDepth,
          frontBackPulse,
          spectrum,
          nyquist,
        ),
      )
    : 0;
  const backOffset = wallEnabled(params, 'back')
    ? wallEdgeOffset(
        frontBackStrength,
        'positive',
        frontBackWallAnim(
          x,
          y,
          xRows,
          yRows,
          audioDepth,
          frontBackPulse,
          spectrum,
          nyquist,
        ),
      )
    : 0;

  return {
    y: (topOffset * topWeight + bottomOffset * bottomWeight) * amount,
    z: (frontOffset * frontWeight + backOffset * backWeight) * amount,
  };
}

function drawTopBottomWalls({
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
  spectrum,
  nyquist,
  timeMs,
}: DrawWallsArgs) {
  const crazyZ =
    routedNumber(params, routedParams, 'Crazy_z_position', 0) / 100;
  const edgeAlignEnabled = boolParam(params, 'topBottomEdgeAlign', false);
  const edgeAlignAmount = clamp01(
    routedNumber(params, routedParams, 'topBottomEdgeAlignAmount', 0.8),
  );
  const edgeAlignRadius = Math.max(
    0.05,
    routedNumber(params, routedParams, 'topBottomEdgeAlignRadius', 0.75),
  );

  for (let x = 1; x < xRows - 1; x += 1) {
    const falloffX = sineFalloff(x - 1, xRows - 2);

    for (let z = 1; z < zRows - 1; z += 1) {
      const falloffZ = sineFalloff(z - 1, zRows - 2);
      const falloff = (falloffX + falloffZ) / 2;

      const spectralEnergy = spectrumValueHz(
        spectrum,
        nyquist,
        serpentinePosition(x, xRows, z, zRows),
        260,
        2500,
      );
      const energy = spectralEnergy * 1.25 + topBottomPulse * 0.15;
      const anim = falloff * energy * audioDepth;
      const px = -totalWidth / 2 + x * stepX + stepX / 2;
      const pz = -totalDepth / 2 + z * stepZ + stepZ / 2;
      const warpedZ = pz + pz * crazyZ;
      const archStrength = routedNumber(
        params,
        routedParams,
        'topBottomArch',
        0.5,
      );
      const wallPower = Math.max(
        0,
        routedNumber(params, routedParams, 'topBottomWallPower', 1),
      );
      const { startOffset, sizeAdd } = wallMotion(
        anim,
        archStrength,
        wallPower,
        falloff,
        falloffX * falloffZ,
        stepY,
      );

      const edgeAlign = edgeAlignEnabled
        ? topBottomEdgeAlignment({
            params,
            routedParams,
            x,
            z,
            xRows,
            yRows,
            zRows,
            audioDepth,
            sidePulse,
            frontBackPulse,
            spectrum,
            nyquist,
            amount: edgeAlignAmount,
            radius: edgeAlignRadius,
          })
        : { top: { x: 0, z: 0 }, bottom: { x: 0, z: 0 } };

      if (wallEnabled(params, 'top')) {
        const py = totalHeight / 2 - stepY / 2 + startOffset + sizeAdd / 2;

        drawBox(
          p,
          px + edgeAlign.top.x,
          py,
          warpedZ + edgeAlign.top.z,
          xSize,
          ySize + sizeAdd,
          zSize,
          colorForBox(params, routedParams, 'top', falloff, energy, timeMs),
        );
      }

      if (wallEnabled(params, 'bottom')) {
        const py = -totalHeight / 2 + stepY / 2 - startOffset - sizeAdd / 2;

        drawBox(
          p,
          px + edgeAlign.bottom.x,
          py,
          warpedZ + edgeAlign.bottom.z,
          xSize,
          ySize + sizeAdd,
          zSize,
          colorForBox(params, routedParams, 'bottom', falloff, energy, timeMs),
        );
      }
    }
  }
}

type TopBottomEdgeAlignmentArgs = {
  params: SketchParams;
  routedParams: NumericRecord;
  x: number;
  z: number;
  xRows: number;
  yRows: number;
  zRows: number;
  audioDepth: number;
  sidePulse: number;
  frontBackPulse: number;
  spectrum: number[];
  nyquist: number;
  amount: number;
  radius: number;
};

function topBottomEdgeAlignment(args: TopBottomEdgeAlignmentArgs) {
  return {
    top: topBottomEdgeAlignmentForY({ ...args, y: 1 }),
    bottom: topBottomEdgeAlignmentForY({ ...args, y: args.yRows - 2 }),
  };
}

function topBottomEdgeAlignmentForY({
  params,
  routedParams,
  x,
  y,
  z,
  xRows,
  yRows,
  zRows,
  audioDepth,
  sidePulse,
  frontBackPulse,
  spectrum,
  nyquist,
  amount,
  radius,
}: TopBottomEdgeAlignmentArgs & { y: number }) {
  const leftWeight = edgeSideWeight(x, xRows, 'min', radius);
  const rightWeight = edgeSideWeight(x, xRows, 'max', radius);
  const frontWeight = edgeSideWeight(z, zRows, 'min', radius);
  const backWeight = edgeSideWeight(z, zRows, 'max', radius);

  const leftRightStrength = routedNumber(
    params,
    routedParams,
    'leftRightArch',
    0.5,
  );
  const frontBackStrength = routedNumber(
    params,
    routedParams,
    'frontBackArch',
    1.5,
  );

  const leftOffset = wallEnabled(params, 'left')
    ? wallEdgeOffset(
        leftRightStrength,
        'negative',
        sideWallAnim(
          y,
          z,
          yRows,
          zRows,
          audioDepth,
          sidePulse,
          spectrum,
          nyquist,
        ),
      )
    : 0;
  const rightOffset = wallEnabled(params, 'right')
    ? wallEdgeOffset(
        leftRightStrength,
        'positive',
        sideWallAnim(
          y,
          z,
          yRows,
          zRows,
          audioDepth,
          sidePulse,
          spectrum,
          nyquist,
        ),
      )
    : 0;
  const frontOffset = wallEnabled(params, 'front')
    ? wallEdgeOffset(
        frontBackStrength,
        'negative',
        frontBackWallAnim(
          x,
          y,
          xRows,
          yRows,
          audioDepth,
          frontBackPulse,
          spectrum,
          nyquist,
        ),
      )
    : 0;
  const backOffset = wallEnabled(params, 'back')
    ? wallEdgeOffset(
        frontBackStrength,
        'positive',
        frontBackWallAnim(
          x,
          y,
          xRows,
          yRows,
          audioDepth,
          frontBackPulse,
          spectrum,
          nyquist,
        ),
      )
    : 0;

  return {
    x: (leftOffset * leftWeight + rightOffset * rightWeight) * amount,
    z: (frontOffset * frontWeight + backOffset * backWeight) * amount,
  };
}
