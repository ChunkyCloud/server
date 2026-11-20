import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsPositive,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { MINIMUM_CANVAS_SIZE } from '../../accounting/workUnits';
import { DEFAULT_BRANCH_COUNT } from '../taskSplitting';

export class EstimateJobCostDto {
  @IsInt()
  @Min(MINIMUM_CANVAS_SIZE)
  @Max(Number.MAX_SAFE_INTEGER)
  @ApiProperty({
    minimum: MINIMUM_CANVAS_SIZE,
    maximum: Number.MAX_SAFE_INTEGER,
    example: 1920,
  })
  width!: number;

  @IsInt()
  @Min(MINIMUM_CANVAS_SIZE)
  @Max(Number.MAX_SAFE_INTEGER)
  @ApiProperty({
    minimum: MINIMUM_CANVAS_SIZE,
    maximum: Number.MAX_SAFE_INTEGER,
    example: 1080,
  })
  height!: number;

  @IsInt()
  @IsPositive()
  @Max(Number.MAX_SAFE_INTEGER)
  @ApiProperty({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER, example: 1000 })
  spp!: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  @ApiPropertyOptional({
    description:
      'Branch count from the scene, used to estimate the sample split',
    minimum: 1,
    maximum: 2_147_483_647,
    default: DEFAULT_BRANCH_COUNT,
  })
  branchCount?: number;

  @IsBoolean()
  @ApiProperty()
  createDump!: boolean;
}

export class EstimateJobCostResponse {
  @ApiProperty({
    description: 'Estimated work units as an integer string',
    example: '2073600000',
  })
  workUnits!: string;

  @ApiProperty({
    description: 'Tip to put the new job into the front 10% of the queue',
    example: '2073600000',
  })
  recommendedTipPerTask!: string;

  @ApiProperty({
    description:
      'Estimated number of tasks using the supplied branch count (or the Chunky default)',
    example: 4,
  })
  tasksCount!: number;
}
