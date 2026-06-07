import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * After login via OAuth, users are redirected to the API. To know if and where we should redirect them, we store temporary, short-lived auth-codes. They can then be used to get a refresh token.
 */
@Entity()
export class AuthCode {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  @Index({ unique: true })
  code!: string;

  @ManyToOne(() => User, { nullable: false })
  user!: User;

  @Column()
  expiresAt!: Date;

  @Column({ nullable: true })
  usedAt!: Date;
}
