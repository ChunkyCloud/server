import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AuthIdentity } from './authIdentity.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  displayName!: string;

  @OneToMany(() => AuthIdentity, (authIdentity) => authIdentity.user)
  authIdentities!: AuthIdentity[];
}
