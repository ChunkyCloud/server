import { BadRequestException } from '@nestjs/common';

// Chunky PersistentSettings.DEFAULT_BRANCH_COUNT.
export const DEFAULT_BRANCH_COUNT = 10;

export function getSceneTaskSppLimit(
  spp: number,
  maxSppPerTask: number,
  scene: unknown,
): number {
  const sceneBranchCount =
    typeof scene === 'object' && scene !== null && 'branchCount' in scene
      ? scene.branchCount
      : undefined;
  const branchCount =
    sceneBranchCount === undefined ? DEFAULT_BRANCH_COUNT : sceneBranchCount;
  if (
    typeof branchCount !== 'number' ||
    !Number.isSafeInteger(branchCount) ||
    branchCount < 1 ||
    branchCount > 2_147_483_647
  ) {
    throw new BadRequestException(
      'Scene branch count must be a positive 32-bit integer',
    );
  }
  if (maxSppPerTask >= spp) return maxSppPerTask;

  // Chunky initially advances one SPP at a time, then jumps to branchCount
  // and advances in whole branches. Only the final remainder may overshoot.
  return maxSppPerTask >= branchCount
    ? Math.floor(maxSppPerTask / branchCount) * branchCount
    : Math.min(maxSppPerTask, Math.floor(Math.sqrt(branchCount)) + 1);
}
