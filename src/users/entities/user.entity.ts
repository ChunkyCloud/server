import { RenderJob } from 'src/jobs/entities/job.entity';
import { RenderNode } from 'src/nodes/entities/renderNode.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AuthIdentity } from './authIdentity.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  displayName!: string;

  @Column({ nullable: true, type: 'varchar' })
  avatarUrl!: string | null;

  @OneToMany(() => AuthIdentity, (authIdentity) => authIdentity.user)
  authIdentities!: AuthIdentity[];

  @OneToMany(() => RenderNode, (renderNode) => renderNode.user)
  renderNodes!: RenderNode[];

  @OneToMany(() => RenderJob, (renderJob) => renderJob.user)
  renderJobs!: RenderJob[];
}
