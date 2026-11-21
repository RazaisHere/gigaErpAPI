import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CognitoService } from '../cognito/cognito.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let users: {
    findByEmailWithPassword: jest.Mock;
    findByEmailForAuth: jest.Mock;
    toAuthProfile: jest.Mock;
    clearMustChangePassword: jest.Mock;
    findByIdForAuth: jest.Mock;
    findByIdWithPassword: jest.Mock;
    updatePassword: jest.Mock;
  };
  let cognito: {
    authenticate: jest.Mock;
    completeNewPassword: jest.Mock;
  };
  let config: { get: jest.Mock };
  let jwt: { signAsync: jest.Mock };

  const profile = {
    id: '1',
    name: 'Ali',
    email: 'muhammad.ali@gigagroup.pk',
    status: 'active',
    mustChangePassword: false,
    roleCode: 'superadmin',
    roleName: 'Superadmin',
    departmentId: null,
    departmentCode: null,
    departmentName: null,
    isDepartmentAdmin: false,
  };

  beforeEach(() => {
    users = {
      findByEmailWithPassword: jest.fn(),
      findByEmailForAuth: jest.fn(),
      toAuthProfile: jest.fn().mockReturnValue(profile),
      clearMustChangePassword: jest.fn(),
      findByIdForAuth: jest.fn(),
      findByIdWithPassword: jest.fn(),
      updatePassword: jest.fn(),
    };
    cognito = {
      authenticate: jest.fn(),
      completeNewPassword: jest.fn(),
    };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'auth.provider') return 'cognito';
        if (key === 'jwt.expiresIn') return '8h';
        return undefined;
      }),
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('nest-token') };

    auth = new AuthService(
      users as unknown as UsersService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
      cognito as unknown as CognitoService,
    );
  });

  it('returns Cognito tokens on login when AUTH_PROVIDER=cognito', async () => {
    users.findByEmailForAuth.mockResolvedValue({
      ...profile,
      cognitoSub: 'sub-1',
    });
    cognito.authenticate.mockResolvedValue({
      kind: 'tokens',
      tokens: {
        accessToken: 'at',
        idToken: 'it',
        refreshToken: 'rt',
        tokenType: 'Bearer',
        expiresIn: 3600,
      },
    });

    const result = (await auth.login(
      'muhammad.ali@gigagroup.pk',
      'Workspace@123',
    )) as {
      accessToken: string;
      refreshToken: string;
      user: { email: string };
    };

    expect(result.accessToken).toBe('at');
    expect(result.refreshToken).toBe('rt');
    expect(result.user.email).toBe('muhammad.ali@gigagroup.pk');
  });

  it('returns NEW_PASSWORD_REQUIRED challenge without tokens', async () => {
    users.findByEmailForAuth.mockResolvedValue({
      ...profile,
      id: '2',
      cognitoSub: 'sub-2',
      status: 'pending_first_login',
      mustChangePassword: true,
    });
    cognito.authenticate.mockResolvedValue({
      kind: 'challenge',
      challengeName: 'NEW_PASSWORD_REQUIRED',
      session: 'sess',
      challengeParameters: {},
    });

    const result = await auth.login(
      'hamza.qureshi@gigagroup.pk',
      'Workspace@123',
    );

    expect(result).toMatchObject({
      challengeName: 'NEW_PASSWORD_REQUIRED',
      session: 'sess',
    });
    expect((result as { accessToken?: string }).accessToken).toBeUndefined();
  });

  it('rejects Cognito login when user has no cognito_sub', async () => {
    users.findByEmailForAuth.mockResolvedValue({
      id: '1',
      cognitoSub: null,
      status: 'active',
    });

    await expect(
      auth.login('muhammad.ali@gigagroup.pk', 'Workspace@123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
