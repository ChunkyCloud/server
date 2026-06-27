import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ReportTaskProgressDto {
  @IsInt()
  @Min(0)
  @ApiProperty({ type: 'integer', minimum: 1 })
  spp!: number;
}
