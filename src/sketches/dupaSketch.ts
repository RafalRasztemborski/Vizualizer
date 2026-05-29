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

const WALL_PARAM: Record<WallName, string> = {
  front: 'showFrontWall',
  back: 'showBackWall',
  left: 'showLeftWall',
  right: 'showRightWall',
  top: 'showTopWall',
  bottom: 'showBottomWall',
};

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

function clearWebglTrail(p: p5, alpha: number) {
  const gl = p.drawingContext as WebGLRenderingContext;

  p.push();
  p.resetMatrix();
  gl.disable(gl.DEPTH_TEST);
  p.noStroke();
  p.fill(0, 0, 0, alpha);
  p.rect(-p.width / 2, -p.height / 2, p.width, p.height);
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

    {
      key: 'z_position',
      label: 'Z position',
      type: 'number',
      min: -2000,
      max: 800,
      step: 1,
      defaultValue: 0,
    },
    {
      key: 'Crazy_z_position',
      label: 'Crazy Z',
      type: 'number',
      min: -50,
      max: 50,
      step: 1,
      defaultValue: 0,
    },
    {
      key: 'audioDepth',
      label: 'Audio depth',
      type: 'number',
      min: 0,
      max: 500,
      step: 1,
      defaultValue: 90,
    },
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
  ],
  setup(p) {
    p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    p.colorMode(p.HSB, 360, 100, 100, 255);
  },
  draw(frame) {
    drawDupa(frame);
  },
  windowResized(p) {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  },
};

function drawDupa({ p, params, routedParams, signals, timeMs }: RuntimeFrame) {
  clearWebglTrail(
    p,
    Math.max(
      0,
      Math.min(255, routedNumber(params, routedParams, 'trailAlpha', 80)),
    ),
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
  const sidePulse = signals.bass * 0.75 + signals.kickEnergy * 1.8;
  const topBottomPulse = signals.mid;
  const frontBackPulse = signals.high;
  const spectrum = signals.dataArray;
  const nyquist = signals.nyquist;
  const edgeWeight = Math.max(
    0,
    routedNumber(params, routedParams, 'edgeWeight', 1),
  );

  p.push();
  p.translate(0, 0, routedNumber(params, routedParams, 'z_position', 0));
  p.rotateX(
    p.radians(routedNumber(params, routedParams, 'X_ROTATE', 0)) +
      Math.sin(t * 0.4) * signals.high * 0.25,
  );
  p.rotateY(
    p.radians(routedNumber(params, routedParams, 'Y_ROTATE', 0)) +
      Math.sin(t * 0.35) * signals.bass * 0.25,
  );
  p.rotateZ(p.radians(routedNumber(params, routedParams, 'Z_ROTATE', 0)));

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
  frontBackPulse,
  spectrum,
  nyquist,
  timeMs,
}: DrawWallsArgs) {
  for (let x = 1; x < xRows - 1; x += 1) {
    const falloffX = sineFalloff(x, xRows);

    for (let y = 1; y < yRows - 1; y += 1) {
      const falloff = falloffX * sineFalloff(y, yRows);
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

      if (wallEnabled(params, 'front')) {
        drawBox(
          p,
          px,
          py,
          //-totalDepth / 2 + stepZ / 2 - anim / 2,
          -totalDepth / 2 + stepZ - anim * 2,
          xSize,
          ySize,
          zSize + anim,
          colorForBox(params, routedParams, 'front', falloff, energy, timeMs),
        );
      }

      if (wallEnabled(params, 'back')) {
        drawBox(
          p,
          px,
          py,
          // -totalWidth / 2 - anim + stepX * 2,
          //totalDepth / 2 - stepZ / 2 + anim / 2,
          totalDepth / 2 - stepZ + anim * 2,
          xSize,
          ySize,
          zSize + anim,
          colorForBox(params, routedParams, 'back', falloff, energy, timeMs),
        );
      }
    }
  }
}

function drawLeftRightWalls({
  p,
  params,
  routedParams,
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
  spectrum,
  nyquist,
  timeMs,
}: DrawWallsArgs) {
  const crazyZ =
    routedNumber(params, routedParams, 'Crazy_z_position', 0) / 100;

  for (let y = 1; y < yRows - 1; y += 1) {
    const falloffY = sineFalloff(y, yRows);

    for (let z = 1; z < zRows - 1; z += 1) {
      const falloff = falloffY * sineFalloff(z, zRows);
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

      if (wallEnabled(params, 'left')) {
        drawBox(
          p,
          // -totalWidth / 2 + stepX / 2 - anim / 2, (old way)
          -totalWidth / 2 - anim + stepX * 2,
          py,
          warpedZ,
          xSize + anim,
          ySize,
          zSize,
          colorForBox(params, routedParams, 'left', falloff, energy, timeMs),
        );
      }

      if (wallEnabled(params, 'right')) {
        drawBox(
          p,
          // totalWidth / 2 - stepX / 2 + anim / 2(old wAY),
          totalWidth / 2 + anim - stepX * 2,
          py,
          warpedZ,
          xSize + anim,
          ySize,
          zSize,
          colorForBox(params, routedParams, 'right', falloff, energy, timeMs),
        );
      }
    }
  }
}

function drawTopBottomWalls({
  p,
  params,
  routedParams,
  xRows,
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
  topBottomPulse,
  spectrum,
  nyquist,
  timeMs,
}: DrawWallsArgs) {
  const crazyZ =
    routedNumber(params, routedParams, 'Crazy_z_position', 0) / 100;

  for (let x = 1; x < xRows - 1; x += 1) {
    const falloffX = sineFalloff(x, xRows);

    for (let z = 1; z < zRows - 1; z += 1) {
      const falloff = falloffX * sineFalloff(z, zRows);
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

      if (wallEnabled(params, 'top')) {
        drawBox(
          p,
          px,
          //totalHeight / 2 - stepY / 2 + anim / 2,
          totalHeight / 2 - stepY * 2 + anim,
          warpedZ,
          xSize,
          ySize + anim,
          zSize,
          colorForBox(params, routedParams, 'top', falloff, energy, timeMs),
        );
      }

      if (wallEnabled(params, 'bottom')) {
        drawBox(
          p,
          px,
          // -totalHeight / 2 + stepY / 2 - anim / 2,
          -totalHeight / 2 + stepY * 2 - anim,
          warpedZ,
          xSize,
          ySize + anim,
          zSize,
          colorForBox(params, routedParams, 'bottom', falloff, energy, timeMs),
        );
      }
    }
  }
}
