import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity()
@Index(['user', 'provider'], { unique: true })
@Index(['provider', 'providerUserId'], { unique: true })
export class AuthIdentity {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (user) => user.authIdentities, { nullable: false })
  user!: User;

  @Column({ nullable: false })
  provider!: string;

  @Column({ nullable: false })
  providerUserId!: string;

  @Column({ type: 'mediumtext', nullable: true })
  providerData: unknown;
}
