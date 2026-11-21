import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true, nullable: true })
  userId!: string | null;

  @Column({ name: 'role_code', type: 'varchar', length: 40, nullable: true })
  roleCode!: string | null;

  @Column({
    name: 'department_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  departmentId!: string | null;

  @Column({ type: 'varchar', length: 80 })
  action!: string;

  @Column({ type: 'varchar', length: 80 })
  module!: string;

  @Column({ name: 'subject_type', type: 'varchar', length: 80, nullable: true })
  subjectType!: string | null;

  @Column({
    name: 'subject_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  subjectId!: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
