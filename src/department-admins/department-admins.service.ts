import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashPassword } from '../auth/utils/password.util';
import { UserIdentityService } from '../cognito/user-identity.service';
import { Department } from '../users/entities/department.entity';
import { DepartmentUser } from '../users/entities/department-user.entity';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { CreateDepartmentAdminDto } from './dto/create-department-admin.dto';
import { UpdateDepartmentAdminDto } from './dto/update-department-admin.dto';

@Injectable()
export class DepartmentAdminsService {
  constructor(
    @InjectRepository(User, 'workspace')
    private readonly users: Repository<User>,
    @InjectRepository(Role, 'workspace')
    private readonly roles: Repository<Role>,
    @InjectRepository(UserRole, 'workspace')
    private readonly userRoles: Repository<UserRole>,
    @InjectRepository(Department, 'workspace')
    private readonly departments: Repository<Department>,
    @InjectRepository(DepartmentUser, 'workspace')
    private readonly departmentUsers: Repository<DepartmentUser>,
    private readonly identity: UserIdentityService,
  ) {}

  async findAll() {
    const rows = await this.users
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.userRoles', 'userRoles')
      .innerJoinAndSelect('userRoles.role', 'role')
      .leftJoinAndSelect('user.departmentUsers', 'departmentUsers')
      .leftJoinAndSelect('departmentUsers.department', 'department')
      .where('role.code = :code', { code: 'department_admin' })
      .andWhere('departmentUsers.isAdmin = :isAdmin', { isAdmin: true })
      .orderBy('user.id', 'ASC')
      .getMany();

    return rows.map((u) => this.toResponse(u));
  }

  async create(dto: CreateDepartmentAdminDto) {
    const department = await this.requireDepartment(dto.departmentId);
    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`Email ${dto.email} already registered`);
    }

    const role = await this.requireRole('department_admin');
    const tempPassword =
      dto.temporaryPassword ?? this.identity.defaultTempPassword;
    const passwordHash = await hashPassword(tempPassword);

    const user = await this.users.save(
      this.users.create({
        name: dto.name,
        email: dto.email.toLowerCase(),
        phone: dto.phone ?? null,
        password: passwordHash,
        mustChangePassword: true,
        status: 'pending_first_login',
      }),
    );

    await this.userRoles.save(
      this.userRoles.create({ user, role }),
    );
    await this.departmentUsers.save(
      this.departmentUsers.create({
        user,
        department,
        isAdmin: true,
      }),
    );

    await this.identity.linkOrCreate({
      userId: String(user.id),
      email: user.email,
      name: user.name,
      phone: user.phone,
      password: tempPassword,
      permanent: false,
    });

    const loaded = await this.loadAdmin(String(user.id));
    return this.toResponse(loaded);
  }

  async update(id: string, dto: UpdateDepartmentAdminDto) {
    const user = await this.loadAdmin(id);

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.status !== undefined) {
      user.status = dto.status;
      if (dto.status === 'active' && user.mustChangePassword) {
        user.status = 'pending_first_login';
      }
    }

    await this.users.save(user);

    if (dto.departmentId !== undefined) {
      const department = await this.requireDepartment(dto.departmentId);
      const membership = user.departmentUsers?.[0];
      if (membership) {
        membership.department = department;
        membership.isAdmin = true;
        await this.departmentUsers.save(membership);
      } else {
        await this.departmentUsers.save(
          this.departmentUsers.create({
            user,
            department,
            isAdmin: true,
          }),
        );
      }
    }

    return this.toResponse(await this.loadAdmin(id));
  }

  async resetPassword(id: string) {
    const user = await this.loadAdmin(id);
    const tempPassword = this.identity.defaultTempPassword;
    user.password = await hashPassword(tempPassword);
    user.mustChangePassword = true;
    if (user.status !== 'disabled') {
      user.status = 'pending_first_login';
    }
    await this.users.save(user);
    await this.identity.resetPassword(user.email, tempPassword, false);
    return {
      ok: true,
      userId: String(user.id),
      mustChangePassword: true,
      temporaryPasswordHint:
        'Reset to default seed password; user must change on next login',
    };
  }

  async disable(id: string) {
    const result = await this.update(id, { status: 'disabled' });
    const user = await this.loadAdmin(id);
    await this.identity.setEnabled(user.email, false);
    return result;
  }

  async enable(id: string) {
    const user = await this.loadAdmin(id);
    user.status = user.mustChangePassword ? 'pending_first_login' : 'active';
    await this.users.save(user);
    await this.identity.setEnabled(user.email, true);
    return this.toResponse(await this.loadAdmin(id));
  }

  private async loadAdmin(id: string): Promise<User> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.password')
      .innerJoinAndSelect('user.userRoles', 'userRoles')
      .innerJoinAndSelect('userRoles.role', 'role')
      .leftJoinAndSelect('user.departmentUsers', 'departmentUsers')
      .leftJoinAndSelect('departmentUsers.department', 'department')
      .where('user.id = :id', { id })
      .andWhere('role.code = :code', { code: 'department_admin' })
      .getOne();

    if (!user) {
      throw new NotFoundException(`Department admin ${id} not found`);
    }
    return user;
  }

  private async requireDepartment(id: string): Promise<Department> {
    const department = await this.departments.findOne({ where: { id } });
    if (!department) {
      throw new NotFoundException(`Department ${id} not found`);
    }
    return department;
  }

  private async requireRole(code: string): Promise<Role> {
    const role = await this.roles.findOne({ where: { code } });
    if (!role) {
      throw new NotFoundException(`Role ${code} not found`);
    }
    return role;
  }

  private toResponse(user: User) {
    const dept = user.departmentUsers?.[0]?.department;
    return {
      id: String(user.id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      mustChangePassword: Boolean(user.mustChangePassword),
      role: user.userRoles?.[0]?.role
        ? {
            code: user.userRoles[0].role.code,
            name: user.userRoles[0].role.name,
          }
        : null,
      department: dept
        ? {
            id: String(dept.id),
            code: dept.code,
            name: dept.name,
          }
        : null,
    };
  }
}
