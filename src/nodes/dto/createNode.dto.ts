import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNodeDto {
  @ApiProperty({
    example: 'My first render node',
    maxLength: 200,
    required: false,
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  name?: string;
}
