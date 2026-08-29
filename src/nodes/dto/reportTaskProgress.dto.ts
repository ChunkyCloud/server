import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Min } from 'class-validator';

export class ReportTaskProgressDto {
  @IsInt()
  @Min(0)
  @ApiProperty({ type: 'integer', minimum: 1 })
  spp!: number;

  @IsNumber()
  @Min(0)
  @ApiProperty({ type: 'number', minimum: 0 })
  sps!: number;
}
