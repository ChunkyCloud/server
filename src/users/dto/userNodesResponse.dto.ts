import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserNodeResponseDto {
  @ApiProperty()
  id!: number;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  lastSeenAt?: Date;
}

export type UserNodesResponseDto = UserNodeResponseDto[];
