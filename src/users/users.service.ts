import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

export type AuthUserProfile = {
  id: string;
  name: string;
  email: string;
  status: string;
  mustChangePassword: boolean;
  roleCode: string;
  roleName: string;
  departmentId: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  isDepartmentAdmin: boolean;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User, 'workspace')
    private readonly users: Repository<User>,
  ) {}

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .leftJoinAndSelect('user.departmentUsers', 'departmentUsers')
      .leftJoinAndSelect('departmentUsers.department', 'department')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findByEmailForAuth(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .leftJoinAndSelect('user.departmentUsers', 'departmentUsers')
      .leftJoinAndSelect('departmentUsers.department', 'department')
      .where('user.email = :email', { email: email.toLowerCase() })
      .getOne();
  }

  async findByCognitoSub(cognitoSub: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .leftJoinAndSelect('user.departmentUsers', 'departmentUsers')
      .leftJoinAndSelect('departmentUsers.department', 'department')
      .where('user.cognitoSub = :cognitoSub', { cognitoSub })
      .getOne();
  }

  async findByIdForAuth(id: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .leftJoinAndSelect('user.departmentUsers', 'departmentUsers')
      .leftJoinAndSelect('departmentUsers.department', 'department')
      .where('user.id = :id', { id })
      .getOne();
  }

  async setCognitoSub(userId: string, cognitoSub: string): Promise<void> {
    await this.users.update({ id: userId }, { cognitoSub });
  }

  async clearMustChangePassword(userId: string): Promise<void> {
    await this.users.update(
      { id: userId },
      { mustChangePassword: false, status: 'active' },
    );
  }

  async listAllForCognitoSync(): Promise<User[]> {
    return this.users.find({ order: { id: 'ASC' } });
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .leftJoinAndSelect('user.departmentUsers', 'departmentUsers')
      .leftJoinAndSelect('departmentUsers.department', 'department')
      .where('user.id = :id', { id })
      .getOne();
  }

  toAuthProfile(user: User): AuthUserProfile {
    const userRole = user.userRoles?.[0];
    const deptUser = user.departmentUsers?.[0];

    if (!userRole?.role) {
      throw new NotFoundException('User has no role assigned');
    }

    return {
      id: String(user.id),
      name: user.name,
      email: user.email,
      status: user.status,
      mustChangePassword: Boolean(user.mustChangePassword),
      roleCode: userRole.role.code,
      roleName: userRole.role.name,
      departmentId: deptUser?.department
        ? String(deptUser.department.id)
        : null,
      departmentCode: deptUser?.department?.code ?? null,
      departmentName: deptUser?.department?.name ?? null,
      isDepartmentAdmin: Boolean(deptUser?.isAdmin),
    };
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.users.update(
      { id: userId },
      {
        password: passwordHash,
        mustChangePassword: false,
        status: 'active',
      },
    );
  }
}
