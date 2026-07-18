import { ResourcePack } from 'src/resourcePacks/entities/resourcePack.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { RenderJob } from './job.entity';

@Entity()
export class RenderJobResourcePack {
  @PrimaryColumn()
  jobId!: number;

  @PrimaryColumn()
  resourcePackId!: number;

  @Column({ type: 'tinyint' })
  orderIndex!: number;

  @ManyToOne(() => RenderJob)
  @JoinColumn({ name: 'jobId' })
  job!: RenderJob;

  @ManyToOne(() => ResourcePack)
  @JoinColumn({ name: 'resourcePackId' })
  resourcePack!: ResourcePack;
}
