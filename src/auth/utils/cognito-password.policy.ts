import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Matches current Cognito User Pool password policy for this project:
 * min 8, ≥1 number, ≥1 special, ≥1 uppercase (lowercase not required).
 */
export const COGNITO_PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and contain at least 1 uppercase letter, 1 number, and 1 special character';

export const COGNITO_PASSWORD_REGEX =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function passwordMeetsCognitoPolicy(password: string): boolean {
  return COGNITO_PASSWORD_REGEX.test(password);
}

/** Turn Cognito InvalidPasswordException text into the same clear requirements. */
export function formatCognitoPasswordError(cognitoMessage: string): string {
  const missing: string[] = [];
  const m = cognitoMessage.toLowerCase();
  if (m.includes('uppercase')) missing.push('1 uppercase letter');
  if (m.includes('lowercase')) missing.push('1 lowercase letter');
  if (m.includes('numeric') || m.includes('number')) missing.push('1 number');
  if (m.includes('symbol') || m.includes('special'))
    missing.push('1 special character');
  if (m.includes('long enough') || m.includes('length') || m.includes('minimum'))
    missing.push('at least 8 characters');

  if (missing.length) {
    return `Password does not meet requirements: need ${missing.join(', ')}. (${COGNITO_PASSWORD_REQUIREMENTS_MESSAGE})`;
  }
  return `${COGNITO_PASSWORD_REQUIREMENTS_MESSAGE}. ${cognitoMessage}`;
}

@ValidatorConstraint({ name: 'isCognitoPassword', async: false })
export class IsCognitoPasswordConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown) {
    return typeof value === 'string' && passwordMeetsCognitoPolicy(value);
  }

  defaultMessage() {
    return COGNITO_PASSWORD_REQUIREMENTS_MESSAGE;
  }
}

export function IsCognitoPassword(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCognitoPasswordConstraint,
    });
  };
}
