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
  topBottomWallAnim,
  wallEdgeOffset,
  wallMotion,
} from './wallMath';

export function drawLeftRightWalls({
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
  const edgeAlignEnabled = boolParam(params, 'leftRightEdgeAlign', false);
  const edgeAlignAmount = clamp01(
    routedNumber(params, routedParams, 'leftRightEdgeAlignAmount', 0.8),
  );
  const edgeAlignRadius = Math.max(
    0.05,
    routedNumber(params, routedParams, 'leftRightEdgeAlignRadius', 0.75),
  );
  const mirrorLeftWall = boolParam(params, 'mirrorLeftWall', false);
  const mirrorRightWall = boolParam(params, 'mirrorRightWall', false);
  const leftWallLayout = stringParam(
    params,
    'leftWallLayout',
    'normal',
  ) as WallLayoutStyle;
  const rightWallLayout = stringParam(
    params,
    'rightWallLayout',
    'normal',
  ) as WallLayoutStyle;

  const motionForCell = (sampleY: number, sampleZ: number) => {
    const falloffY = sineFalloff(sampleY - 1, yRows - 2);
    const falloffZ = sineFalloff(sampleZ - 1, zRows - 2);
    const falloff = (falloffY + falloffZ) / 2;

    const spectralEnergy = spectrumValueHz(
      spectrumLR,
      nyquist,
      serpentinePosition(sampleZ, zRows, sampleY, yRows),
      routedNumber(params, routedParams, 'Left&RightHZRangeMin', 35),
      routedNumber(params, routedParams, 'Left&RightHZRangeMax', 260),
    );
    const energy = spectralEnergy * 1.25 + sidePulse * 0.15;
    const anim = falloff * energy * audioDepth;
    const archStrength = archStrengthWithSine(
      params,
      routedParams,
      'leftRightArch',
      0.5,
      serpentinePosition(sampleZ, zRows, sampleY, yRows),
    );
    const wallPower = Math.max(
      0,
      routedNumber(params, routedParams, 'leftRightWallPower', 1),
    );

    return {
      falloff,
      energy,
      ...wallMotion(
        anim,
        archStrength,
        wallPower,
        falloff,
        falloffY * falloffZ,
        stepX,
      ),
    };
  };

  for (let y = 1; y < yRows - 1; y += 1) {
    for (let z = 1; z < zRows - 1; z += 1) {
      const py = totalHeight / 2 - y * stepY - stepY / 2;
      const pz = -totalDepth / 2 + z * stepZ + stepZ / 2;
      const warpedZ = pz + pz * crazyZ;

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
        : { left: { y: 0, z: 0 }, right: { y: 0, z: 0 } };

      if (wallEnabled(params, 'left')) {
        const leftSample = transformWallSample(
          y,
          z,
          yRows,
          zRows,
          leftWallLayout,
          mirrorLeftWall,
        );
        const leftMotion = motionForCell(
          leftSample.primary,
          leftSample.secondary,
        );
        const px =
          -totalWidth / 2 +
          stepX / 2 -
          leftMotion.startOffset -
          leftMotion.sizeAdd / 2;

        drawBox(
          p,
          px,
          py + edgeAlign.left.y,
          warpedZ + edgeAlign.left.z,
          xSize + leftMotion.sizeAdd,
          ySize,
          zSize,
          colorForBox(
            params,
            routedParams,
            'left',
            leftMotion.falloff,
            leftMotion.energy,
            timeMs,
          ),
        );
      }

      if (wallEnabled(params, 'right')) {
        const rightSample = transformWallSample(
          y,
          z,
          yRows,
          zRows,
          rightWallLayout,
          mirrorRightWall,
        );
        const rightMotion = motionForCell(
          rightSample.primary,
          rightSample.secondary,
        );
        const px =
          totalWidth / 2 -
          stepX / 2 +
          rightMotion.startOffset +
          rightMotion.sizeAdd / 2;

        drawBox(
          p,
          px,
          py + edgeAlign.right.y,
          warpedZ + edgeAlign.right.z,
          xSize + rightMotion.sizeAdd,
          ySize,
          zSize,
          colorForBox(
            params,
            routedParams,
            'right',
            rightMotion.falloff,
            rightMotion.energy,
            timeMs,
          ),
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
  sidePulse: number;
  spectrumLR: number[];
  spectrumTB: number[];
  spectrumFB: number[];
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
  sidePulse,
  topBottomPulse,
  frontBackPulse,
  spectrumLR,
  spectrumTB,
  spectrumFB,
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
    y: (topOffset * topWeight + bottomOffset * bottomWeight) * amount,
    z: (frontOffset * frontWeight + backOffset * backWeight) * amount,
  };
}
