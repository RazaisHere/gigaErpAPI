import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { formatCognitoPasswordError } from '../auth/utils/cognito-password.policy';

/** AWS SDK v3 errors expose `name` and often `__type`. */
export function cognitoErrorName(err: unknown): string {
  if (!err || typeof err !== 'object') return '';
  const e = err as { name?: string; __type?: string };
  return String(e.name || e.__type || '');
}

export function cognitoErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? '');
}

/** True for Cognito / AWS SDK client faults we should map to HTTP. */
export function isCognitoSdkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    name?: string;
    __type?: string;
    $fault?: string;
    $metadata?: unknown;
  };
  if (e.$metadata != null || e.$fault != null) return true;
  const name = cognitoErrorName(err);
  return (
    name.endsWith('Exception') ||
    name.includes('Cognito') ||
    name === 'InvalidPasswordException'
  );
}

/** Phone attribute issues — safe to retry SignUp without phone_number. */
export function isPhoneAttributeError(err: unknown): boolean {
  const name = cognitoErrorName(err);
  const msg = cognitoErrorMessage(err);
  if (name === 'InvalidPasswordException') return false;
  if (name === 'UsernameExistsException') return false;
  if (name === 'CodeMismatchException') return false;
  if (name === 'ExpiredCodeException') return false;
  if (name === 'InvalidParameterException') {
    return /phone/i.test(msg) || /E\.?164/i.test(msg) || /attribute/i.test(msg);
  }
  // Pool may reject phone format with a generic InvalidParameterException
  return /phone/i.test(msg);
}

/**
 * Map Cognito/AWS errors to Nest HttpExceptions.
 * Returns null if the error is not a recognized Cognito/AWS client error.
 */
export function tryMapCognitoError(err: unknown): HttpException | null {
  if (err instanceof HttpException) return err;
  if (!isCognitoSdkError(err)) return null;

  const name = cognitoErrorName(err);
  const message = cognitoErrorMessage(err);

  if (
    name === 'AccessDeniedException' ||
    message.includes('not authorized to perform')
  ) {
    return new BadRequestException(
      'Cognito IAM permissions are incomplete. Attach Admin* actions (see docs/cognito-iam-policy.json), or use USER_PASSWORD_AUTH with COGNITO_CLIENT_SECRET.',
    );
  }
  if (
    message.includes('SECRET_HASH') ||
    message.includes('secret but SECRET_HASH')
  ) {
    return new BadRequestException(
      'Cognito app client has a client secret. Add COGNITO_CLIENT_SECRET to .env.',
    );
  }
  if (message.includes('USER_PASSWORD_AUTH')) {
    return new BadRequestException(
      'Enable ALLOW_USER_PASSWORD_AUTH on the Cognito app client (Authentication flows).',
    );
  }

  switch (name) {
    case 'InvalidPasswordException':
      return new BadRequestException(formatCognitoPasswordError(message));
    case 'UsernameExistsException':
      return new ConflictException(
        'An account with this email already exists. If you have not confirmed it, request a new code.',
      );
    case 'CodeMismatchException':
    case 'ExpiredCodeException':
      return new BadRequestException(
        name === 'ExpiredCodeException'
          ? 'Verification code has expired. Request a new code.'
          : 'Invalid verification code.',
      );
    case 'InvalidParameterException':
      return new BadRequestException(message || 'Invalid request to Cognito');
    case 'TooManyRequestsException':
    case 'LimitExceededException':
      return new BadRequestException(
        'Too many attempts. Please wait a moment and try again.',
      );
    case 'UserNotConfirmedException':
      return new UnauthorizedException('Email is not confirmed yet');
    case 'PasswordResetRequiredException':
      return new UnauthorizedException(
        'Password reset required. Use forgot-password.',
      );
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      return new UnauthorizedException('Invalid email or password');
    case 'UserLambdaValidationException':
      return new BadRequestException(message || 'Signup validation failed');
    case 'InvalidUserPoolConfigurationException':
      return new BadRequestException(
        'Cognito User Pool / app client is misconfigured.',
      );
    case 'ForbiddenException':
      return new ForbiddenException(message || 'Forbidden');
    default:
      // Unknown Cognito client error — still avoid raw 500 with stack semantics
      if (message) {
        return new BadRequestException(message);
      }
      return new BadRequestException('Cognito request failed');
  }
}

/** Always throws an HttpException (mapped or generic BadRequest). */
export function mapCognitoError(err: unknown): never {
  const mapped = tryMapCognitoError(err);
  if (mapped) throw mapped;
  if (err instanceof HttpException) throw err;
  throw new BadRequestException(
    err instanceof Error ? err.message : 'Cognito request failed',
  );
}
