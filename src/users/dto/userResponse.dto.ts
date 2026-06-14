import { ApiProperty } from '@nestjs/swagger';

export class UserResponse {
  @ApiProperty({ example: 42 })
  id!: number;

  @ApiProperty({ example: 'Steve' })
  displayName!: string;
}
