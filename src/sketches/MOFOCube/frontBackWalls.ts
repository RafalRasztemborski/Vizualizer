import type { NumericRecord, SketchParams } from '../../core/types';
import {
  boolParam,
  clamp01,
  edgeSideWeight,
  routedNumber,
  sineFalloff,
  serpentinePosition,
  spectrumValueHz,
  wallEnabled,
} from './helpers';
import { colorForBox, drawBox } from './rendering';
import type { DrawWallsArgs } from './types';
import {
  archStrengthWithSine,
  sideWallAnim,
  topBottomWallAnim,
  wallEdgeOffset,
  wallMotion,
} from './wallMath';

export function drawFrontBackWalls({
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
        spectrumFB,
        nyquist,
        serpentinePosition(x, xRows, y, yRows),
        routedNumber(params, routedParams, 'Front&BackHZRangeMin', 2500),
        routedNumber(params, routedParams, 'Front&BackHZRangeMax', 12000),
      );
      const energy = spectralEnergy * 1.25 + frontBackPulse * 0.15;
      const anim = falloff * energy * audioDepth;
      const px = -totalWidth / 2 + x * stepX + stepX / 2;
      const py = totalHeight / 2 - y * stepY - stepY / 2;
      const archStrength = archStrengthWithSine(
        params,
        routedParams,
        'frontBackArch',
        1.5,
        serpentinePosition(x, xRows, y, yRows),
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
          spectrumLR,
          spectrumTB,
          spectrumFB,
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
  spectrumLR: number[];
  spectrumTB: number[];
  spectrumFB: number[];
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
  spectrumLR,
  spectrumTB,
  spectrumFB,
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
        spectrumTB,
        nyquist,
        params,
        routedParams,
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
        spectrumTB,
        nyquist,
        params,
        routedParams,
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
        spectrumLR,
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
        spectrumLR,
        nyquist,
      ),
    )
    : 0;

  return {
    x: (leftOffset * leftWeight + rightOffset * rightWeight) * amount,
    y: (topOffset * topWeight + bottomOffset * bottomWeight) * amount,
  };
}

