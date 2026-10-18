import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { JobAssetType } from '../assets';
import { Asset } from './asset.entity';
import { RenderJob } from './job.entity';

@Entity()
@Unique(['jobId', 'role'])
export class RenderJobAsset {
  @PrimaryColumn()
  jobId!: number;

  @PrimaryColumn({ type: 'enum', enum: JobAssetType })
  role!: JobAssetType;

  @Column()
  assetId!: number;

  @ManyToOne(() => RenderJob, (job) => job.assets, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'jobId' })
  job!: RenderJob;

  @ManyToOne(() => Asset, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assetId' })
  asset!: Asset;
}
