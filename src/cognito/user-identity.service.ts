import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { CognitoService } from './cognito.service';

const DEFAULT_TEMP_PASSWORD = 'Workspace@123';

@Injectable()
export class UserIdentityService {
  private readonly logger = new Logger(UserIdentityService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cognito: CognitoService,
    private readonly users: UsersService,
  ) {}

  get isCognito(): boolean {
    return this.config.get<string>('auth.provider') === 'cognito';
  }

  get defaultTempPassword(): string {
    return DEFAULT_TEMP_PASSWORD;
  }

  /**
   * When AUTH_PROVIDER=cognito, create/link the Cognito user and store cognito_sub.
   * No-op in nest mode.
   */
  async linkOrCreate(params: {
    userId: string;
    email: string;
    name: string;
    phone?: string | null;
    password: string;
    permanent?: boolean;
  }): Promise<void> {
    if (!this.isCognito) {
      return;
    }

    const sub = await this.cognito.ensureUser({
      email: params.email,
      name: params.name,
      phone: params.phone,
      temporaryPassword: params.password,
      permanent: params.permanent,
    });
    await this.users.setCognitoSub(params.userId, sub);
    this.logger.log(`Linked user ${params.userId} → Cognito sub ${sub}`);
  }

  async resetPassword(email: string, password: string, permanent = false) {
    if (!this.isCognito) {
      return;
    }
    if (permanent) {
      await this.cognito.setPermanentPassword(email, password);
    } else {
      await this.cognito.setTemporaryPassword(email, password);
    }
  }

  async setEnabled(email: string, enabled: boolean) {
    if (!this.isCognito) {
      return;
    }
    if (enabled) {
      await this.cognito.enableUser(email);
    } else {
      await this.cognito.disableUser(email);
    }
  }
}
