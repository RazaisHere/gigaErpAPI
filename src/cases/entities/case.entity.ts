import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from '../../users/entities/department.entity';
import { User } from '../../users/entities/user.entity';
import { CaseCategory } from './case-category.entity';
import { CaseHandoff } from './case-handoff.entity';
import { CaseNote } from './case-note.entity';

@Entity({ name: 'cases' })
export class CaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'case_no', type: 'varchar', length: 30, unique: true })
  caseNo!: string;

  @Column({ name: 'source_client_id', type: 'int', unsigned: true, nullable: true })
  sourceClientId!: number | null;

  @Column({
    name: 'source_unitsale_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  sourceUnitsaleId!: number | null;

  @Column({ name: 'source_unit_id', type: 'int', unsigned: true, nullable: true })
  sourceUnitId!: number | null;

  @Column({
    name: 'source_receipt_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  sourceReceiptId!: number | null;

  @ManyToOne(() => CaseCategory, { eager: true })
  @JoinColumn({ name: 'category_id' })
  category!: CaseCategory;

  @ManyToOne(() => Department, { eager: true })
  @JoinColumn({ name: 'department_id' })
  department!: Department;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'assignee_user_id' })
  assignee!: User | null;

  @Column({ type: 'varchar', length: 40, default: 'New' })
  status!: string;

  @Column({ type: 'varchar', length: 20, default: 'Normal' })
  priority!: string;

  @Column({ name: 'sla_band', type: 'varchar', length: 20, default: 'On track' })
  slaBand!: string;

  @Column({ name: 'opened_at', type: 'timestamptz', nullable: true })
  openedAt!: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy!: User | null;

  @OneToMany(() => CaseNote, (n) => n.case)
  notes!: CaseNote[];

  @OneToMany(() => CaseHandoff, (h) => h.case)
  handoffs!: CaseHandoff[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
