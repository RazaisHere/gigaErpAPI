import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CognitoService } from '../cognito/cognito.service';
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
    private readonly cognito: CognitoService,
  ) {}

  private get isCognito(): boolean {
    return this.config.get<string>('auth.provider') === 'cognito';
  }

  async login(email: string, password: string) {
    if (this.isCognito) {
      return this.loginWithCognito(email, password);
    }
    return this.loginWithNest(email, password);
  }

  async completeNewPassword(
    email: string,
    newPassword: string,
    session: string,
  ) {
    this.requireCognito();
    const user = await this.requireActiveWorkspaceUser(email);

    const result = await this.cognito.completeNewPassword({
      email,
      newPassword,
      session,
    });

    if (result.kind === 'challenge') {
      return {
        challengeName: result.challengeName,
        session: result.session,
        challengeParameters: result.challengeParameters ?? {},
      };
    }

    await this.users.clearMustChangePassword(String(user.id));
    const profile = this.users.toAuthProfile(
      (await this.users.findByIdForAuth(String(user.id)))!,
    );

    return {
      ...result.tokens,
      user: this.toPublicUser(profile),
    };
  }

  async refresh(email: string, refreshToken: string) {
    this.requireCognito();
    const user = await this.requireActiveWorkspaceUser(email);
    const tokens = await this.cognito.refresh(email, refreshToken);
    const profile = this.users.toAuthProfile(user);
    return {
      ...tokens,
      user: this.toPublicUser(profile),
    };
  }

  async forgotPassword(email: string) {
    this.requireCognito();
    // Always succeed to avoid email enumeration
    const user = await this.users.findByEmailForAuth(email.trim());
    if (user && ACTIVE_STATUSES.has(user.status)) {
      await this.cognito.forgotPassword(email);
    }
    return {
      ok: true,
      message: 'If the account exists, a reset code has been sent',
    };
  }

  async confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ) {
    this.requireCognito();
    await this.cognito.confirmForgotPassword({ email, code, newPassword });
    const user = await this.users.findByEmailForAuth(email.trim());
    if (user) {
      await this.users.clearMustChangePassword(String(user.id));
    }
    return { ok: true };
  }

  async me(profile: AuthUserProfile) {
    return this.toPublicUser(profile);
  }

  async logout(accessToken?: string) {
    if (this.isCognito && accessToken) {
      try {
        await this.cognito.globalSignOut(accessToken);
      } catch {
        // Token may already be invalid; client should discard anyway
      }
    }
    return { ok: true };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    accessToken?: string,
  ) {
    if (currentPassword === newPassword) {
      throw new ForbiddenException(
        'New password must be different from the current password',
      );
    }

    if (this.isCognito) {
      if (!accessToken) {
        throw new UnauthorizedException('Access token required');
      }
      await this.cognito.changePassword(
        accessToken,
        currentPassword,
        newPassword,
      );
      await this.users.clearMustChangePassword(userId);
      const refreshed = await this.users.findByIdForAuth(userId);
      if (!refreshed) {
        throw new UnauthorizedException('User not found');
      }
      return {
        ok: true,
        user: this.toPublicUser(this.users.toAuthProfile(refreshed)),
      };
    }

    const user = await this.users.findByIdWithPassword(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const valid = await verifyPassword(currentPassword, user.password);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hash = await hashPassword(newPassword);
    await this.users.updatePassword(userId, hash);

    const refreshed = await this.users.findByIdForAuth(userId);
    if (!refreshed) {
      throw new UnauthorizedException('User not found');
    }
    const profile = this.users.toAuthProfile(refreshed);
    const nestToken = await this.signToken(profile);

    return {
      accessToken: nestToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('jwt.expiresIn') ?? '8h',
      user: this.toPublicUser(profile),
    };
  }

  private async loginWithNest(email: string, password: string) {
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

  private async loginWithCognito(email: string, password: string) {
    const user = await this.requireActiveWorkspaceUser(email);

    if (!user.cognitoSub) {
      throw new UnauthorizedException(
        'User is not linked to Cognito; run the Cognito sync script',
      );
    }

    try {
      const result = await this.cognito.authenticate(email, password);

      if (result.kind === 'challenge') {
        return {
          challengeName: result.challengeName,
          session: result.session,
          challengeParameters: result.challengeParameters ?? {},
          user: this.toPublicUser(this.users.toAuthProfile(user)),
        };
      }

      return {
        ...result.tokens,
        user: this.toPublicUser(this.users.toAuthProfile(user)),
      };
    } catch (err) {
      throw new UnauthorizedException(
        err instanceof Error ? 'Invalid email or password' : 'Invalid email or password',
      );
    }
  }

  private async requireActiveWorkspaceUser(email: string) {
    const user = await this.users.findByEmailForAuth(email.trim());
    if (!user || !ACTIVE_STATUSES.has(user.status)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }

  private requireCognito() {
    if (!this.isCognito) {
      throw new BadRequestException(
        'This endpoint requires AUTH_PROVIDER=cognito',
      );
    }
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
