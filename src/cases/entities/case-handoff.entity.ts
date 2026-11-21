import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Department } from '../../users/entities/department.entity';
import { User } from '../../users/entities/user.entity';
import { CaseEntity } from './case.entity';

@Entity({ name: 'case_handoffs' })
export class CaseHandoff {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @ManyToOne(() => CaseEntity, (c) => c.handoffs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case!: CaseEntity;

  @ManyToOne(() => Department, { eager: true })
  @JoinColumn({ name: 'from_department_id' })
  fromDepartment!: Department;

  @ManyToOne(() => Department, { eager: true })
  @JoinColumn({ name: 'to_department_id' })
  toDepartment!: Department;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'by_user_id' })
  byUser!: User;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
