import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AuthenticateDto {
  @ApiProperty()
  @IsString()
  code!: string;
}
