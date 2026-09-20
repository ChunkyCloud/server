import { ApiProperty } from '@nestjs/swagger';

export class UserResponse {
  @ApiProperty({ example: 42 })
  id!: number;

  @ApiProperty({ example: 'Steve' })
  displayName!: string;

  @ApiProperty({
    type: 'string',
    format: 'uri',
    nullable: true,
    example: 'https://cdn.discordapp.com/avatars/123/abc.png',
  })
  avatarUrl!: string | null;

  @ApiProperty({ example: '1337', type: 'string', pattern: '^\\d+$' })
  credits!: string;
}
