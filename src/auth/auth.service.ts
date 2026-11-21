import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthUserProfile, UsersService } from '../users/users.service';
import { JwtPayload } from './types/jwt-payload';
import { hashPassword, verifyPassword } from './utils/password.util';

const ACTIVE_STATUSES = new Set(['active', 'pending_first_login']);

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmailWithPassword(email.trim());
    const valid = await verifyPassword(password, user?.password);

    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!ACTIVE_STATUSES.has(user.status)) {
      throw new UnauthorizedException('User account is disabled');
    }

    const profile = this.users.toAuthProfile(user);
    const accessToken = await this.signToken(profile);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('jwt.expiresIn') ?? '8h',
      user: this.toPublicUser(profile),
    };
  }

  async me(profile: AuthUserProfile) {
    return this.toPublicUser(profile);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.users.findByIdWithPassword(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const valid = await verifyPassword(currentPassword, user.password);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new ForbiddenException(
        'New password must be different from the current password',
      );
    }

    const hash = await hashPassword(newPassword);
    await this.users.updatePassword(userId, hash);

    const refreshed = await this.users.findByIdForAuth(userId);
    if (!refreshed) {
      throw new UnauthorizedException('User not found');
    }
    const profile = this.users.toAuthProfile(refreshed);
    const accessToken = await this.signToken(profile);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('jwt.expiresIn') ?? '8h',
      user: this.toPublicUser(profile),
    };
  }

  private async signToken(profile: AuthUserProfile): Promise<string> {
    const payload: JwtPayload = {
      sub: profile.id,
      roleCode: profile.roleCode,
      departmentId: profile.departmentId,
    };
    return this.jwt.signAsync(payload);
  }

  private toPublicUser(profile: AuthUserProfile) {
    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      status: profile.status,
      mustChangePassword: profile.mustChangePassword,
      role: {
        code: profile.roleCode,
        name: profile.roleName,
      },
      department: profile.departmentId
        ? {
            id: profile.departmentId,
            code: profile.departmentCode,
            name: profile.departmentName,
            isAdmin: profile.isDepartmentAdmin,
          }
        : null,
    };
  }
}
