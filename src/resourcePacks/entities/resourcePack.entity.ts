import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ResourcePack {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'tinytext', default: '' })
  description!: string;

  @Column({ nullable: true })
  url?: string;
}
