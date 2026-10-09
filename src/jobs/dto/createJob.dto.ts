import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ResourcePackDto {
  @IsInt()
  @IsPositive()
  @ApiProperty({ description: 'Resource pack ID' })
  id!: number;
}

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
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  @ApiPropertyOptional({
    description:
      'Minimum available RAM in bytes required on nodes to run this job. If not specified, the job will run on any node regardless of available RAM.',
    type: 'integer',
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
    default: 0,
  })
  minimumRam?: number;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  createDump?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ResourcePackDto)
  @ApiProperty({
    type: ResourcePackDto,
    isArray: true,
    minItems: 1,
  })
  resourcePacks!: ResourcePackDto[];
}
