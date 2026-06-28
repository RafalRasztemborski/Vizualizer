import type { DrawWallsArgs } from './types';
import { drawFrontBackWalls } from './frontBackWalls';
import { drawLeftRightWalls } from './leftRightWalls';
import { drawTopBottomWalls } from './topBottomWalls';

export function drawWalls(args: DrawWallsArgs) {
  drawFrontBackWalls(args);
  drawLeftRightWalls(args);
  drawTopBottomWalls(args);
}
