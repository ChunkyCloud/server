import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsPositive, Max } from 'class-validator';

export class EstimateJobCostDto {
  @IsInt()
  @IsPositive()
  @Max(Number.MAX_SAFE_INTEGER)
  @ApiProperty({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER, example: 1920 })
  width!: number;

  @IsInt()
  @IsPositive()
  @Max(Number.MAX_SAFE_INTEGER)
  @ApiProperty({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER, example: 1080 })
  height!: number;

  @IsInt()
  @IsPositive()
  @Max(Number.MAX_SAFE_INTEGER)
  @ApiProperty({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER, example: 1000 })
  spp!: number;

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
    description: 'Number of tasks of the job',
    example: 4,
  })
  tasksCount!: number;
}
