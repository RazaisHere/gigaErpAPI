import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  isPhoneAttributeError,
  tryMapCognitoError,
} from './cognito-errors';

function awsErr(name: string, message: string) {
  const err = new Error(message) as Error & {
    name: string;
    __type: string;
    $fault: string;
    $metadata: { httpStatusCode: number };
  };
  err.name = name;
  err.__type = name;
  err.$fault = 'client';
  err.$metadata = { httpStatusCode: 400 };
  return err;
}

describe('cognito-errors', () => {
  it('maps InvalidPasswordException to 400 with clear requirements', () => {
    const mapped = tryMapCognitoError(
      awsErr(
        'InvalidPasswordException',
        'Password did not conform with policy: Password must have uppercase characters',
      ),
    );
    expect(mapped).toBeInstanceOf(BadRequestException);
    expect(mapped?.message).toContain('1 uppercase letter');
    expect(mapped?.message).toContain('special character');
    expect(mapped?.getStatus()).toBe(400);
  });

  it('maps UsernameExistsException to 409', () => {
    const mapped = tryMapCognitoError(
      awsErr('UsernameExistsException', 'User already exists'),
    );
    expect(mapped).toBeInstanceOf(ConflictException);
  });

  it('maps NotAuthorizedException to 401', () => {
    const mapped = tryMapCognitoError(
      awsErr('NotAuthorizedException', 'Incorrect username or password.'),
    );
    expect(mapped).toBeInstanceOf(UnauthorizedException);
  });

  it('does not treat password errors as phone attribute errors', () => {
    expect(
      isPhoneAttributeError(
        awsErr(
          'InvalidPasswordException',
          'Password did not conform with policy: Password must have lowercase characters',
        ),
      ),
    ).toBe(false);
  });

  it('detects phone attribute InvalidParameterException', () => {
    expect(
      isPhoneAttributeError(
        awsErr(
          'InvalidParameterException',
          'Invalid phone number format. Please provide a phone number in E.164 format.',
        ),
      ),
    ).toBe(true);
  });
});
