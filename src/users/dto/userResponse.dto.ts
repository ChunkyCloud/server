import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponse {
  @ApiProperty({ example: 42 })
  id!: number;

  @ApiProperty({ example: 'Steve' })
  displayName!: string;

  @ApiPropertyOptional({
    example: 'https://cdn.discordapp.com/avatars/123/abc.png',
  })
  avatarUrl!: string | null;
}
