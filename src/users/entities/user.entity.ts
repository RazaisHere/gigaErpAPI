import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DepartmentUser } from './department-user.entity';
import { UserRole } from './user-role.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({
    name: 'cognito_sub',
    type: 'varchar',
    length: 36,
    unique: true,
    nullable: true,
  })
  cognitoSub!: string | null;

  @Column({ type: 'varchar', length: 255, select: false })
  password!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ name: 'employee_code', type: 'varchar', length: 20, nullable: true })
  employeeCode!: string | null;

  @Column({ name: 'face_image', type: 'varchar', length: 255, nullable: true })
  faceImage!: string | null;

  @Column({
    name: 'must_change_password',
    type: 'tinyint',
    width: 1,
    default: 0,
  })
  mustChangePassword!: boolean;

  @Column({ type: 'varchar', length: 30, default: 'active' })
  status!: string;

  @OneToMany(() => UserRole, (ur) => ur.user)
  userRoles!: UserRole[];

  @OneToMany(() => DepartmentUser, (du) => du.user)
  departmentUsers!: DepartmentUser[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
