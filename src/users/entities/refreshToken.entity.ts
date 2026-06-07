import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity()
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { nullable: false })
  user!: User;

  @Column()
  @Index()
  tokenHash!: string;

  @Column()
  createdAt!: Date;

  @Column()
  expiresAt!: Date;

  @Column({ nullable: true })
  revokedAt?: Date;
}
