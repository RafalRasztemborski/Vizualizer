import type { NumericRecord, SketchParams } from '../../core/types';
import {
  boolParam,
  clamp01,
  edgeSideWeight,
  routedNumber,
  sineFalloff,
  serpentinePosition,
  spectrumValueHz,
  stringParam,
  transformWallSample,
  type WallLayoutStyle,
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
  const mirrorTopWall = boolParam(params, 'mirrorTopWall', false);
  const mirrorBottomWall = boolParam(params, 'mirrorBottomWall', false);
  const topWallLayout = stringParam(
    params,
    'topWallLayout',
    'normal',
  ) as WallLayoutStyle;
  const bottomWallLayout = stringParam(
    params,
    'bottomWallLayout',
    'normal',
  ) as WallLayoutStyle;

  const motionForCell = (sampleX: number, sampleZ: number) => {
    const falloffX = sineFalloff(sampleX - 1, xRows - 2);
    const falloffZ = sineFalloff(sampleZ - 1, zRows - 2);
    const falloff = (falloffX + falloffZ) / 2;

    const spectralEnergy = spectrumValueHz(
      spectrumTB,
      nyquist,
      serpentinePosition(sampleX, xRows, sampleZ, zRows),
      routedNumber(params, routedParams, 'TopBottomHZRangeMin', 260),
      routedNumber(params, routedParams, 'TopBottomHZRangeMax', 2500),
    );
    const energy = spectralEnergy * 1.25 + topBottomPulse * 0.15;
    const anim = falloff * energy * audioDepth;
    const archStrength = archStrengthWithSine(
      params,
      routedParams,
      'topBottomArch',
      0.5,
      serpentinePosition(sampleX, xRows, sampleZ, zRows),
    );
    const wallPower = Math.max(
      0,
      routedNumber(params, routedParams, 'topBottomWallPower', 1),
    );

    return {
      falloff,
      energy,
      ...wallMotion(
        anim,
        archStrength,
        wallPower,
        falloff,
        falloffX * falloffZ,
        stepY,
      ),
    };
  };

  for (let x = 1; x < xRows - 1; x += 1) {
    for (let z = 1; z < zRows - 1; z += 1) {
      const px = -totalWidth / 2 + x * stepX + stepX / 2;
      const pz = -totalDepth / 2 + z * stepZ + stepZ / 2;
      const warpedZ = pz + pz * crazyZ;

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
        const topSample = transformWallSample(
          x,
          z,
          xRows,
          zRows,
          topWallLayout,
          mirrorTopWall,
        );
        const topMotion = motionForCell(topSample.primary, topSample.secondary);
        const py =
          totalHeight / 2 -
          stepY / 2 +
          topMotion.startOffset +
          topMotion.sizeAdd / 2;

        drawBox(
          p,
          px + edgeAlign.top.x,
          py,
          //warpedZ + edgeAlign.top.z,
          warpedZ + edgeAlign.top.z,
          xSize,
          ySize + topMotion.sizeAdd,
          zSize,
          colorForBox(
            params,
            routedParams,
            'top',
            topMotion.falloff,
            topMotion.energy,
            timeMs,
          ),
        );
      }

      if (wallEnabled(params, 'bottom')) {
        const bottomSample = transformWallSample(
          x,
          z,
          xRows,
          zRows,
          bottomWallLayout,
          mirrorBottomWall,
        );
        const bottomMotion = motionForCell(
          bottomSample.primary,
          bottomSample.secondary,
        );
        const py =
          -totalHeight / 2 +
          stepY / 2 -
          bottomMotion.startOffset -
          bottomMotion.sizeAdd / 2;

        drawBox(
          p,
          px + edgeAlign.bottom.x,
          py,
          warpedZ + edgeAlign.bottom.z,
          xSize,
          ySize + bottomMotion.sizeAdd,
          zSize,
          colorForBox(
            params,
            routedParams,
            'bottom',
            bottomMotion.falloff,
            bottomMotion.energy,
            timeMs,
          ),
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
