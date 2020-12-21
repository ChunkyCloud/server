import {
  IsBoolean,
  IsIn,
  IsInt,
  IsJSON,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateJobDto {
  @IsInt()
  @Min(1)
  targetSpp: number;

  @IsOptional()
  @IsBoolean()
  transient?: boolean;

  @IsOptional()
  @IsBoolean()
  pictureOnly?: boolean;

  @IsOptional()
  @IsJSON()
  cachedRegions?: string;

  @IsOptional()
  @IsIn(['1.x', '2.x'])
  chunkyVersion?: '1.x' | '2.x';

  @IsOptional()
  @IsString()
  texturepack?: string;
}
