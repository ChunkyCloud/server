import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty({
    type: 'object',
    properties: {
      expiresAt: {
        type: 'string',
        format: 'date-time',
      },
      token: { type: 'string' },
    },
    required: ['expiresAt', 'token'],
    additionalProperties: false,
    selfRequired: true,
  })
  refreshToken!: {
    expiresAt: Date;
    token: string;
  };

  @ApiProperty()
  accessToken!: string;
}
