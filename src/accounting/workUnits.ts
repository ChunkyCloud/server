import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RenderTask, RenderTaskStatus } from '../jobs/entities/task.entity';

export const MINIMUM_CANVAS_SIZE = 20;

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
  const minTileSize = 64;
  const maxTileSize = createDump ? 200 : 500; // reduce tile size when dumps need to be uploaded
  // Existing render-time target: 5 million samples (100x100 at 500 SPP).
  const targetSamplesPerTask = 5_000_000;
  const targetTileSize = Math.round(Math.sqrt(targetSamplesPerTask / spp));
  const tileSize = Math.max(minTileSize, Math.min(maxTileSize, targetTileSize));
  const maxSppPerTask =
    tileSize === minTileSize
      ? Math.min(
          spp,
          Math.max(
            1,
            Math.floor(
              targetSamplesPerTask /
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
  const queuedTasks = await taskRepository.find({
    where: { status: RenderTaskStatus.Queued },
    select: { tip: true, workUnits: true },
  });

  if (queuedTasks.length === 0) return 0n;

  // sort by priority
  queuedTasks.sort((a, b) => {
    const left = a.tip * b.workUnits;
    const right = b.tip * a.workUnits;
    return left > right ? -1 : left < right ? 1 : 0;
  });

  // aim for a higher priority than 90 % of the existing tasks
  const index = Math.max(0, Math.ceil(queuedTasks.length * 0.1) - 1);
  const threshold = queuedTasks[index];

  // smallest integer tip per task that beats the threshold
  return (threshold.tip * maxWorkUnitsPerTask) / threshold.workUnits + 1n;
}
