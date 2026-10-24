import { SkymapFileType, type SkyMode } from '../assets';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  ValidateIf,
  IsInt,
  IsIn,
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

export class SkyAssetDto {
  @IsEnum(SkymapFileType)
  @ApiProperty({ enum: SkymapFileType, enumName: 'SkymapFileType' })
  type!: SkymapFileType;
}

export class JobAssetsDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => SkyAssetDto)
  @ApiPropertyOptional({ type: SkyAssetDto })
  skyboxTop?: SkyAssetDto;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => SkyAssetDto)
  @ApiPropertyOptional({ type: SkyAssetDto })
  skyboxBottom?: SkyAssetDto;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => SkyAssetDto)
  @ApiPropertyOptional({ type: SkyAssetDto })
  skyboxLeft?: SkyAssetDto;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => SkyAssetDto)
  @ApiPropertyOptional({ type: SkyAssetDto })
  skyboxRight?: SkyAssetDto;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => SkyAssetDto)
  @ApiPropertyOptional({ type: SkyAssetDto })
  skyboxFront?: SkyAssetDto;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => SkyAssetDto)
  @ApiPropertyOptional({ type: SkyAssetDto })
  skyboxBack?: SkyAssetDto;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => SkyAssetDto)
  @ApiPropertyOptional({ type: SkyAssetDto })
  skymap?: SkyAssetDto;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  emitterGrid?: boolean;
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
      'Minimum (advertised) memory in megabytes required on nodes to run this job. If not specified, the job will run on any node.',
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

  @IsOptional()
  @IsIn(['skybox', 'skymap'])
  @ApiPropertyOptional({
    enum: ['skybox', 'skymap'],
    nullable: true,
    default: null,
  })
  skyMode?: SkyMode;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => JobAssetsDto)
  @ApiPropertyOptional({
    type: JobAssetsDto,
    description: 'Asset options.',
  })
  assets?: JobAssetsDto;

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

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({
    description: 'Tip per render task',
    type: 'integer',
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
    default: 0,
  })
  tipPerTask?: number;
}
