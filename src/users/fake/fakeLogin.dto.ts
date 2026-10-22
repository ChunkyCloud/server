import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FakeLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nonce!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  username!: string;
}
