import {
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AuthFlowType,
  ChallengeNameType,
  ChangePasswordCommand,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  MessageActionType,
  ResendConfirmationCodeCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import {
  cognitoErrorName,
  isPhoneAttributeError,
  mapCognitoError,
} from './cognito-errors';

export type CognitoTokens = {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
};

export type CognitoAuthResult =
  | { kind: 'tokens'; tokens: CognitoTokens }
  | {
      kind: 'challenge';
      challengeName: string;
      session: string;
      challengeParameters?: Record<string, string>;
    };

@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);
  private readonly client: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly region: string;

  constructor(private readonly config: ConfigService) {
    this.region = this.config.getOrThrow<string>('cognito.region');
    this.userPoolId = this.config.getOrThrow<string>('cognito.userPoolId');
    this.clientId = this.config.getOrThrow<string>('cognito.clientId');
    this.clientSecret = this.config.get<string>('cognito.clientSecret') ?? '';
    this.client = new CognitoIdentityProviderClient({ region: this.region });
  }

  get issuer(): string {
    return `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`;
  }

  get jwksUri(): string {
    return `${this.issuer}/.well-known/jwks.json`;
  }

  get appClientId(): string {
    return this.clientId;
  }

  /**
   * Create (or fetch) a Cognito user and optionally set a permanent password.
   * Username is the workspace email.
   */
  async ensureUser(params: {
    email: string;
    name: string;
    phone?: string | null;
    temporaryPassword: string;
    permanent?: boolean;
  }): Promise<string> {
    const username = params.email.toLowerCase();
    let sub: string | undefined;

    const baseAttrs = [
      { Name: 'email', Value: username },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'name', Value: params.name },
    ];

    try {
      const created = await this.client.send(
        new AdminCreateUserCommand({
          UserPoolId: this.userPoolId,
          Username: username,
          MessageAction: MessageActionType.SUPPRESS,
          TemporaryPassword: params.temporaryPassword,
          UserAttributes: params.phone
            ? [
                ...baseAttrs,
                { Name: 'phone_number', Value: this.toE164(params.phone) },
              ]
            : baseAttrs,
        }),
      );
      sub = created.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
    } catch (err) {
      if (cognitoErrorName(err) === 'UsernameExistsException') {
        this.logger.debug(`Cognito user already exists: ${username}`);
      } else if (params.phone && isPhoneAttributeError(err)) {
        // Retry without phone if E.164 / pool phone config rejects it
        this.logger.warn(
          `Cognito create with phone failed for ${username}; retrying without phone`,
        );
        try {
          const created = await this.client.send(
            new AdminCreateUserCommand({
              UserPoolId: this.userPoolId,
              Username: username,
              MessageAction: MessageActionType.SUPPRESS,
              TemporaryPassword: params.temporaryPassword,
              UserAttributes: baseAttrs,
            }),
          );
          sub = created.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
        } catch (retryErr) {
          if (cognitoErrorName(retryErr) !== 'UsernameExistsException') {
            mapCognitoError(retryErr);
          }
        }
      } else {
        mapCognitoError(err);
      }
    }

    if (!sub) {
      try {
        const existing = await this.client.send(
          new AdminGetUserCommand({
            UserPoolId: this.userPoolId,
            Username: username,
          }),
        );
        sub = existing.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
      } catch (err) {
        mapCognitoError(err);
      }
    }

    if (!sub) {
      throw new BadRequestException(
        `Could not resolve Cognito sub for ${username}`,
      );
    }

    if (params.permanent !== false) {
      try {
        await this.client.send(
          new AdminSetUserPasswordCommand({
            UserPoolId: this.userPoolId,
            Username: username,
            Password: params.temporaryPassword,
            Permanent: true,
          }),
        );
      } catch (err) {
        mapCognitoError(err);
      }
    }

    return sub;
  }

  async setPermanentPassword(email: string, password: string): Promise<void> {
    try {
      await this.client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: this.userPoolId,
          Username: email.toLowerCase(),
          Password: password,
          Permanent: true,
        }),
      );
    } catch (err) {
      mapCognitoError(err);
    }
  }

  async setTemporaryPassword(email: string, password: string): Promise<void> {
    try {
      await this.client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: this.userPoolId,
          Username: email.toLowerCase(),
          Password: password,
          Permanent: false,
        }),
      );
    } catch (err) {
      mapCognitoError(err);
    }
  }

  async disableUser(email: string): Promise<void> {
    try {
      await this.client.send(
        new AdminDisableUserCommand({
          UserPoolId: this.userPoolId,
          Username: email.toLowerCase(),
        }),
      );
    } catch (err) {
      mapCognitoError(err);
    }
  }

  async enableUser(email: string): Promise<void> {
    try {
      await this.client.send(
        new AdminEnableUserCommand({
          UserPoolId: this.userPoolId,
          Username: email.toLowerCase(),
        }),
      );
    } catch (err) {
      mapCognitoError(err);
    }
  }

  /**
   * Client auth flow (InitiateAuth) — does not need cognito-idp:Admin* IAM.
   * App client must allow USER_PASSWORD_AUTH (+ REFRESH_TOKEN_AUTH).
   */
  async authenticate(email: string, password: string): Promise<CognitoAuthResult> {
    this.assertConfigured();
    const username = email.toLowerCase();
    try {
      const result = await this.client.send(
        new InitiateAuthCommand({
          ClientId: this.clientId,
          AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
          AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
            ...this.secretHashParams(username),
          },
        }),
      );
      return this.toAuthResult(result, 'Cognito authentication failed');
    } catch (err) {
      mapCognitoError(err);
    }
  }

  async completeNewPassword(params: {
    email: string;
    newPassword: string;
    session: string;
  }): Promise<CognitoAuthResult> {
    this.assertConfigured();
    const username = params.email.toLowerCase();
    try {
      const result = await this.client.send(
        new RespondToAuthChallengeCommand({
          ClientId: this.clientId,
          ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
          Session: params.session,
          ChallengeResponses: {
            USERNAME: username,
            NEW_PASSWORD: params.newPassword,
            ...this.secretHashParams(username),
          },
        }),
      );
      return this.toAuthResult(result, 'Failed to complete password challenge');
    } catch (err) {
      mapCognitoError(err);
    }
  }

  async refresh(email: string, refreshToken: string): Promise<CognitoTokens> {
    this.assertConfigured();
    const username = email.toLowerCase();
    try {
      const result = await this.client.send(
        new InitiateAuthCommand({
          ClientId: this.clientId,
          AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
          AuthParameters: {
            REFRESH_TOKEN: refreshToken,
            USERNAME: username,
            ...this.secretHashParams(username),
          },
        }),
      );

      const auth = result.AuthenticationResult;
      if (!auth?.AccessToken) {
        throw new UnauthorizedException('Refresh token is invalid or expired');
      }

      return {
        accessToken: auth.AccessToken,
        idToken: auth.IdToken,
        refreshToken: auth.RefreshToken ?? refreshToken,
        tokenType: auth.TokenType ?? 'Bearer',
        expiresIn: auth.ExpiresIn ?? 3600,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      mapCognitoError(err);
    }
  }

  private toAuthResult(
    result: {
      ChallengeName?: string;
      Session?: string;
      ChallengeParameters?: Record<string, string>;
      AuthenticationResult?: {
        AccessToken?: string;
        IdToken?: string;
        RefreshToken?: string;
        TokenType?: string;
        ExpiresIn?: number;
      };
    },
    failMessage: string,
  ): CognitoAuthResult {
    if (result.ChallengeName && result.Session) {
      return {
        kind: 'challenge',
        challengeName: result.ChallengeName,
        session: result.Session,
        challengeParameters: result.ChallengeParameters,
      };
    }

    const auth = result.AuthenticationResult;
    if (!auth?.AccessToken) {
      throw new UnauthorizedException(failMessage);
    }

    return {
      kind: 'tokens',
      tokens: {
        accessToken: auth.AccessToken,
        idToken: auth.IdToken,
        refreshToken: auth.RefreshToken,
        tokenType: auth.TokenType ?? 'Bearer',
        expiresIn: auth.ExpiresIn ?? 3600,
      },
    };
  }

  async changePassword(
    accessToken: string,
    previousPassword: string,
    proposedPassword: string,
  ): Promise<void> {
    try {
      await this.client.send(
        new ChangePasswordCommand({
          AccessToken: accessToken,
          PreviousPassword: previousPassword,
          ProposedPassword: proposedPassword,
        }),
      );
    } catch (err) {
      mapCognitoError(err);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const username = email.toLowerCase();
    try {
      await this.client.send(
        new ForgotPasswordCommand({
          ClientId: this.clientId,
          Username: username,
          SecretHash: this.secretHash(username),
        }),
      );
    } catch (err) {
      mapCognitoError(err);
    }
  }

  async confirmForgotPassword(params: {
    email: string;
    code: string;
    newPassword: string;
  }): Promise<void> {
    const username = params.email.toLowerCase();
    try {
      await this.client.send(
        new ConfirmForgotPasswordCommand({
          ClientId: this.clientId,
          Username: username,
          ConfirmationCode: params.code,
          Password: params.newPassword,
          SecretHash: this.secretHash(username),
        }),
      );
    } catch (err) {
      mapCognitoError(err);
    }
  }

  async globalSignOut(accessToken: string): Promise<void> {
    try {
      await this.client.send(
        new GlobalSignOutCommand({ AccessToken: accessToken }),
      );
    } catch (err) {
      mapCognitoError(err);
    }
  }

  /**
   * Self-service SignUp. Cognito emails the verification code when the pool
   * is configured for email verification (no custom SMTP needed).
   */
  async signUp(params: {
    email: string;
    password: string;
    name: string;
    phone?: string | null;
  }): Promise<{ userSub?: string; userConfirmed: boolean }> {
    this.assertConfigured();
    const username = params.email.toLowerCase();
    const baseAttrs = [
      { Name: 'email', Value: username },
      { Name: 'name', Value: params.name },
    ];

    const attempt = async (withPhone: boolean) => {
      const attrs =
        withPhone && params.phone
          ? [
              ...baseAttrs,
              { Name: 'phone_number', Value: this.toE164(params.phone) },
            ]
          : baseAttrs;
      return this.client.send(
        new SignUpCommand({
          ClientId: this.clientId,
          Username: username,
          Password: params.password,
          SecretHash: this.secretHash(username),
          UserAttributes: attrs,
        }),
      );
    };

    try {
      const result = await attempt(Boolean(params.phone));
      return {
        userSub: result.UserSub,
        userConfirmed: Boolean(result.UserConfirmed),
      };
    } catch (err) {
      if (cognitoErrorName(err) === 'UsernameExistsException') {
        throw new ConflictException(
          'An account with this email already exists. If you have not confirmed it, request a new code.',
        );
      }
      // Only strip phone on attribute/format errors — never on password policy
      if (params.phone && isPhoneAttributeError(err)) {
        this.logger.warn(
          `Cognito SignUp with phone failed for ${username}; retrying without phone`,
        );
        try {
          const result = await attempt(false);
          return {
            userSub: result.UserSub,
            userConfirmed: Boolean(result.UserConfirmed),
          };
        } catch (retryErr) {
          if (cognitoErrorName(retryErr) === 'UsernameExistsException') {
            throw new ConflictException(
              'An account with this email already exists. If you have not confirmed it, request a new code.',
            );
          }
          mapCognitoError(retryErr);
        }
      }
      mapCognitoError(err);
    }
  }

  async confirmSignUp(email: string, code: string): Promise<void> {
    this.assertConfigured();
    const username = email.toLowerCase();
    try {
      await this.client.send(
        new ConfirmSignUpCommand({
          ClientId: this.clientId,
          Username: username,
          ConfirmationCode: code,
          SecretHash: this.secretHash(username),
        }),
      );
    } catch (err) {
      mapCognitoError(err);
    }
  }

  async resendConfirmationCode(email: string): Promise<void> {
    this.assertConfigured();
    const username = email.toLowerCase();
    try {
      await this.client.send(
        new ResendConfirmationCodeCommand({
          ClientId: this.clientId,
          Username: username,
          SecretHash: this.secretHash(username),
        }),
      );
    } catch (err) {
      mapCognitoError(err);
    }
  }

  async getUserSub(email: string): Promise<string> {
    this.assertConfigured();
    let existing;
    try {
      existing = await this.client.send(
        new AdminGetUserCommand({
          UserPoolId: this.userPoolId,
          Username: email.toLowerCase(),
        }),
      );
    } catch (err) {
      mapCognitoError(err);
    }
    const sub = existing.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
    if (!sub) {
      throw new BadRequestException(
        `Could not resolve Cognito sub for ${email}`,
      );
    }
    return sub;
  }

  isConfigured(): boolean {
    return Boolean(
      this.userPoolId &&
        this.clientId &&
        this.userPoolId !== '...' &&
        this.clientId !== '...',
    );
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'Cognito is not configured. Set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID.',
      );
    }
  }

  private secretHashParams(username: string): Record<string, string> {
    const hash = this.secretHash(username);
    return hash ? { SECRET_HASH: hash } : {};
  }

  private secretHash(username: string): string | undefined {
    if (!this.clientSecret) {
      return undefined;
    }
    return createHmac('sha256', this.clientSecret)
      .update(username + this.clientId)
      .digest('base64');
  }

  /** Best-effort PK mobile → E.164 for Cognito phone attribute. */
  private toE164(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('92')) {
      return `+${digits}`;
    }
    if (digits.startsWith('0') && digits.length === 11) {
      return `+92${digits.slice(1)}`;
    }
    if (phone.startsWith('+')) {
      return phone;
    }
    return `+${digits}`;
  }
}
