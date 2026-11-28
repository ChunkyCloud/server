import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RenderTask, RenderTaskStatus } from '../jobs/entities/task.entity';

export const MINIMUM_CANVAS_SIZE = 20;

export const MIN_TILE_SIZE = 64;
export const MAX_TILE_SIZE = 500;
// Reduce tile size when dumps need to be uploaded.
export const MAX_TILE_SIZE_WITH_DUMP = 200;
// Samples target per task (approximately proportional to render time per task)
export const TARGET_SAMPLES_PER_TASK = 400 * 400 * 100;

export function calculateWorkUnits(
  width: number,
  height: number,
  spp: number,
): bigint {
  if (
    ![width, height, spp].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
  ) {
    throw new BadRequestException(
      'Width, height and SPP must be positive safe integers',
    );
  }
  // Keep estimates, job charges and task rewards on the same formula.
  // Ray depth is not included in the current pricing model.
  return BigInt(width) * BigInt(height) * BigInt(spp);
}

export function getTileSize({
  createDump,
  spp,
  width,
  height,
}: {
  createDump: boolean;
  spp: number;
  width: number;
  height: number;
}) {
  if (
    ![width, height].every(
      (size) => Number.isSafeInteger(size) && size >= MINIMUM_CANVAS_SIZE,
    )
  ) {
    throw new BadRequestException(
      `Canvas width and height must be at least ${MINIMUM_CANVAS_SIZE} pixels`,
    );
  }
  const maxTileSize = createDump ? MAX_TILE_SIZE_WITH_DUMP : MAX_TILE_SIZE;
  const targetTileSize = Math.round(Math.sqrt(TARGET_SAMPLES_PER_TASK / spp));
  const tileSize = Math.max(
    MIN_TILE_SIZE,
    Math.min(maxTileSize, targetTileSize),
  );
  const maxSppPerTask =
    tileSize === MIN_TILE_SIZE
      ? Math.min(
          spp,
          Math.max(
            1,
            Math.floor(
              TARGET_SAMPLES_PER_TASK /
                (Math.min(tileSize, width) * Math.min(tileSize, height)),
            ),
          ),
        )
      : spp;
  const tasksCount =
    Math.ceil(width / tileSize) *
    Math.ceil(height / tileSize) *
    Math.ceil(spp / maxSppPerTask);

  return { tileSize, maxSppPerTask, tasksCount };
}

export function getTileRanges(size: number, tileSize: number) {
  const ranges: { offset: number; size: number }[] = [];
  for (let offset = 0; offset < size; ) {
    let length = Math.min(tileSize, size - offset);
    const remainder = size - offset - length;
    // Borrow pixels from the preceding tile instead of creating tiles that are smaller
    // than Chunky's minimum canvas size. This is safe because the preceding tile is guaranteed
    // to be at least 64 pixels, and the minimum canvas size is 20 pixels.
    // Revisit this guarantee if either minimum changes.
    if (remainder > 0 && remainder < MINIMUM_CANVAS_SIZE) {
      length -= MINIMUM_CANVAS_SIZE - remainder;
    }
    ranges.push({ offset, size: length });
    offset += length;
  }
  return ranges;
}

export async function estimateTop10PercentTipPerTask(
  maxWorkUnitsPerTask: bigint,
  taskRepository: Repository<RenderTask>,
): Promise<bigint> {
  const ranked = taskRepository
    .createQueryBuilder('task')
    .select('task.tip', 'tip')
    .addSelect('task.workUnits', 'workUnits')
    .addSelect(
      'ROW_NUMBER() OVER (ORDER BY CAST(task.tip AS DECIMAL(65, 38)) / task.workUnits DESC, task.id ASC)',
      'priorityRank',
    )
    .addSelect('COUNT(*) OVER ()', 'taskCount')
    .where('task.status = :status', { status: RenderTaskStatus.Queued });
  const threshold = await taskRepository.manager
    .createQueryBuilder()
    .select('ranked.tip', 'tip')
    .addSelect('ranked.workUnits', 'workUnits')
    .from(`(${ranked.getQuery()})`, 'ranked')
    // aim for a higher priority than 90 % of the existing tasks
    .where('ranked.priorityRank = GREATEST(1, CEIL(ranked.taskCount / 10.0))')
    .setParameters(ranked.getParameters())
    .getRawOne<{ tip: string; workUnits: string }>();

  if (!threshold) return 0n;

  // smallest integer tip per task that beats the threshold
  return (
    (BigInt(threshold.tip) * maxWorkUnitsPerTask) /
      BigInt(threshold.workUnits) +
    1n
  );
}
