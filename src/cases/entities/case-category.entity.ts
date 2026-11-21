import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from '../../users/entities/department.entity';

@Entity({ name: 'case_categories' })
export class CaseCategory {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  name!: string;

  @ManyToOne(() => Department, { eager: true })
  @JoinColumn({ name: 'default_department_id' })
  defaultDepartment!: Department;

  @Column({ name: 'default_sla_hours', type: 'int', unsigned: true, default: 48 })
  defaultSlaHours!: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
