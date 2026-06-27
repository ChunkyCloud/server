import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { RenderJobStatus } from 'src/jobs/entities/job.entity';

export class UserJobsQueryDto {
  @ApiPropertyOptional({
    enum: RenderJobStatus,
    enumName: 'JobStatus',
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(RenderJobStatus, { each: true })
  @Transform(({ value }: { value: string | string[] }) =>
    Array.isArray(value) ? value : value ? [value] : [],
  )
  status!: RenderJobStatus[];

  @ApiPropertyOptional({
    enum: ['createdAt', 'startedAt', 'finishedAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt'])
  sort: 'createdAt' | 'startedAt' | 'finishedAt' = 'createdAt';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    enumName: 'Order',
    default: 'asc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({ type: 'integer', minimum: 1, default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 25,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  @Max(100)
  limit: number = 25;
}
