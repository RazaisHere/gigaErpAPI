import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CaseEntity } from './case.entity';

@Entity({ name: 'case_notes' })
export class CaseNote {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @ManyToOne(() => CaseEntity, (c) => c.notes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case!: CaseEntity;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'client_visible', type: 'tinyint', width: 1, default: 0 })
  clientVisible!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
