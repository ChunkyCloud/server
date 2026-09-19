import { BadRequestException } from '@nestjs/common';

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
