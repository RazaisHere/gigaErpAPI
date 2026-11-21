import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from '../../users/entities/department.entity';

@Entity({ name: 'handoff_rules' })
@Unique('handoff_rules_pair_unique', ['fromDepartment', 'toDepartment'])
export class HandoffRule {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @ManyToOne(() => Department, { eager: true })
  @JoinColumn({ name: 'from_department_id' })
  fromDepartment!: Department;

  @ManyToOne(() => Department, { eager: true })
  @JoinColumn({ name: 'to_department_id' })
  toDepartment!: Department;

  @Column({ name: 'is_allowed', type: 'tinyint', width: 1, default: 1 })
  isAllowed!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
