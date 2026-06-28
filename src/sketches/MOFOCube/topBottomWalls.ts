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
  frontBackWallAnim,
  sideWallAnim,
  wallEdgeOffset,
  wallMotion,
} from './wallMath';

export function drawTopBottomWalls({
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
        spectrumTB,
        nyquist,
        serpentinePosition(x, xRows, z, zRows),
        routedNumber(params, routedParams, 'TopBottomHZRangeMin', 260),
        routedNumber(params, routedParams, 'TopBottomHZRangeMax', 2500),
      );
      const energy = spectralEnergy * 1.25 + topBottomPulse * 0.15;
      const anim = falloff * energy * audioDepth;
      const px = -totalWidth / 2 + x * stepX + stepX / 2;
      const pz = -totalDepth / 2 + z * stepZ + stepZ / 2;
      const warpedZ = pz + pz * crazyZ;
      const archStrength = archStrengthWithSine(
        params,
        routedParams,
        'topBottomArch',
        0.5,
        serpentinePosition(x, xRows, z, zRows),
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
          topBottomPulse,
          frontBackPulse,
          spectrumLR,
          spectrumTB,
          spectrumFB,
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
          //warpedZ + edgeAlign.top.z,
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
  topBottomPulse: number;
  frontBackPulse: number;
  spectrumLR: number[];
  spectrumTB: number[];
  spectrumFB: number[];
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
  topBottomPulse,
  frontBackPulse,
  spectrumLR,
  spectrumTB,
  spectrumFB,
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
        spectrumFB,
        nyquist,
        params,
        routedParams,
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
        spectrumFB,
        nyquist,
        params,
        routedParams,
      ),
    )
    : 0;

  return {
    x: (leftOffset * leftWeight + rightOffset * rightWeight) * amount,
    z: (frontOffset * frontWeight + backOffset * backWeight) * amount,
  };
}
