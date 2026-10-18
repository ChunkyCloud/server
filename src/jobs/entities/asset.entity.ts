import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { JobAssetType } from '../assets';

@Entity()
export class Asset {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 255 })
  filename!: string;

  @Column({ type: 'enum', enum: JobAssetType })
  type!: JobAssetType;

  @Column({ unique: true })
  storageKey!: string;

  @ManyToOne(() => User, { nullable: false })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;
}
