import { IsString } from 'class-validator';

export class AuthenticateDto {
  @IsString()
  code!: string;
}
