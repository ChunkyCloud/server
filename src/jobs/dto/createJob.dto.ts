import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
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
  @IsBoolean()
  @ApiPropertyOptional()
  createDump?: boolean;

  @ValidateNested({ each: true })
  @Type(() => ResourcePackDto)
  @ApiProperty({
    type: ResourcePackDto,
    isArray: true,
    minItems: 1,
  })
  resourcePacks!: ResourcePackDto[];
}
