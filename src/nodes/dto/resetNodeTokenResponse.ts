import { ApiProperty } from '@nestjs/swagger';

export class ResetNodeTokenResponse {
  @ApiProperty({
    example: 'rnd_SbCZq48FGYxOm3sdUjjt5ZH-Ap3jsaBLYyBoBuJLVcg',
    description: 'New render node token (can not be retrieved again later)',
  })
  token!: string;
}
