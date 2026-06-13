import { ApiProperty } from '@nestjs/swagger';

export class CreateNodeResponse {
  @ApiProperty({ example: 42 })
  id!: number;

  @ApiProperty({
    example: 'rnd_SbCZq48FGYxOm3sdUjjt5ZH-Ap3jsaBLYyBoBuJLVcg',
    description: 'Render node token (can not be retrieved again later)',
  })
  token!: string;
}
