import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, Max } from 'class-validator';

export class EstimateJobCostDto {
  @IsInt()
  @IsPositive()
  @Max(Number.MAX_SAFE_INTEGER)
  @ApiProperty({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER })
  width!: number;

  @IsInt()
  @IsPositive()
  @Max(Number.MAX_SAFE_INTEGER)
  @ApiProperty({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER })
  height!: number;

  @IsInt()
  @IsPositive()
  @Max(Number.MAX_SAFE_INTEGER)
  @ApiProperty({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER })
  spp!: number;
}

export class EstimateJobCostResponse {
  @ApiProperty({
    description: 'Estimated work units as an integer string',
    example: '207360000',
  })
  workUnits!: string;

  @ApiProperty({
    description:
      'Credit charge as an integer string; currently 1 credit per work unit',
    example: '207360000',
  })
  credits!: string;
}
