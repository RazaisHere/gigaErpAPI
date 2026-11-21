import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestUser } from '../auth/types/jwt-payload';
import { hashPassword } from '../auth/utils/password.util';
import { UserIdentityService } from '../cognito/user-identity.service';
import { Department } from '../users/entities/department.entity';
import { DepartmentUser } from '../users/entities/department-user.entity';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { CreateMemberDto } from './dto/create-member.dto';

@Injectable()
export class MembersService {
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

  async listMembers(actor: RequestUser, departmentFilter?: string) {
    const qb = this.departmentUsers
      .createQueryBuilder('du')
      .innerJoinAndSelect('du.user', 'user')
      .innerJoinAndSelect('du.department', 'department')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .orderBy('department.code', 'ASC')
      .addOrderBy('user.name', 'ASC');

    if (actor.roleCode === 'department_admin') {
      if (!actor.departmentId) {
        throw new ForbiddenException('Department admin has no department scope');
      }
      qb.andWhere('department.id = :deptId', { deptId: actor.departmentId });
    } else if (departmentFilter) {
      qb.andWhere(
        '(department.id = :filter OR department.code = :filter)',
        { filter: departmentFilter },
      );
    }

    const rows = await qb.getMany();
    return rows.map((row) => this.toMembershipResponse(row));
  }

  async listStaff() {
    const rows = await this.users
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.userRoles', 'userRoles')
      .innerJoinAndSelect('userRoles.role', 'role')
      .leftJoinAndSelect('user.departmentUsers', 'departmentUsers')
      .leftJoinAndSelect('departmentUsers.department', 'department')
      .where('role.code = :code', { code: 'employee' })
      .orderBy('user.name', 'ASC')
      .getMany();

    return rows.map((user) => ({
      id: String(user.id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      employeeCode: user.employeeCode,
      status: user.status,
      departments: (user.departmentUsers ?? []).map((du) => ({
        membershipId: String(du.id),
        id: String(du.department.id),
        code: du.department.code,
        name: du.department.name,
        isAdmin: Boolean(du.isAdmin),
      })),
    }));
  }

  async addMember(actor: RequestUser, dto: CreateMemberDto) {
    if (actor.roleCode !== 'superadmin') {
      throw new ForbiddenException('Only the Superadmin can add or remove members');
    }

    const department = await this.requireDepartment(dto.departmentId);
    let user: User;

    if (dto.userId) {
      const found = await this.users.findOne({ where: { id: dto.userId } });
      if (!found) {
        throw new NotFoundException(`User ${dto.userId} not found`);
      }
      user = found;
    } else {
      if (!dto.email || !dto.name) {
        throw new ConflictException('name and email are required when creating a member');
      }
      const existing = await this.users.findOne({
        where: { email: dto.email.toLowerCase() },
      });
      if (existing) {
        throw new ConflictException(`Email ${dto.email} already registered`);
      }

      const role = await this.requireRole('employee');
      const tempPassword =
        dto.temporaryPassword ?? this.identity.defaultTempPassword;
      user = await this.users.save(
        this.users.create({
          name: dto.name,
          email: dto.email.toLowerCase(),
          phone: dto.phone ?? null,
          employeeCode: dto.employeeCode ?? null,
          password: await hashPassword(tempPassword),
          mustChangePassword: true,
          status: 'pending_first_login',
        }),
      );
      await this.userRoles.save(this.userRoles.create({ user, role }));
      await this.identity.linkOrCreate({
        userId: String(user.id),
        email: user.email,
        name: user.name,
        phone: user.phone,
        password: tempPassword,
        permanent: false,
      });
    }

    const existingMembership = await this.departmentUsers.findOne({
      where: {
        user: { id: user.id },
        department: { id: department.id },
      },
    });
    if (existingMembership) {
      throw new ConflictException('User is already a member of this department');
    }

    const membership = await this.departmentUsers.save(
      this.departmentUsers.create({
        user,
        department,
        isAdmin: false,
      }),
    );

    const loaded = await this.departmentUsers.findOne({
      where: { id: membership.id },
      relations: ['user', 'department', 'user.userRoles', 'user.userRoles.role'],
    });
    return this.toMembershipResponse(loaded!);
  }

  async removeMember(actor: RequestUser, membershipId: string) {
    if (actor.roleCode !== 'superadmin') {
      throw new ForbiddenException('Only the Superadmin can add or remove members');
    }

    const membership = await this.departmentUsers.findOne({
      where: { id: membershipId },
      relations: ['user', 'department'],
    });
    if (!membership) {
      throw new NotFoundException(`Membership ${membershipId} not found`);
    }
    if (membership.isAdmin) {
      throw new ConflictException(
        'Cannot remove a department admin via members; use department-admins instead',
      );
    }

    await this.departmentUsers.remove(membership);
    return { ok: true, removedMembershipId: membershipId };
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

  private toMembershipResponse(row: DepartmentUser) {
    const role = row.user.userRoles?.[0]?.role;
    return {
      membershipId: String(row.id),
      isAdmin: Boolean(row.isAdmin),
      user: {
        id: String(row.user.id),
        name: row.user.name,
        email: row.user.email,
        phone: row.user.phone,
        employeeCode: row.user.employeeCode,
        status: row.user.status,
        role: role ? { code: role.code, name: role.name } : null,
      },
      department: {
        id: String(row.department.id),
        code: row.department.code,
        name: row.department.name,
      },
    };
  }
}
