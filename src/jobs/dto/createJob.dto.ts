import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsPositive } from 'class-validator';

export class CreateJobDto {
  @IsInt()
  @IsPositive()
  @ApiProperty()
  spp!: number;

  @IsInt()
  @IsPositive()
  @ApiProperty()
  width!: number;

  @IsInt()
  @IsPositive()
  @ApiProperty()
  height!: number;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  createDump?: boolean;
}
