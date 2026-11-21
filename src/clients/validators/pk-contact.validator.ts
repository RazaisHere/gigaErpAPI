import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/** Pakistan CNIC: 35202-XXXXXXX-X style (5-7-1 digits). */
export const CNIC_REGEX = /^\d{5}-\d{7}-\d$/;

/** Pakistan mobile: 03XX-XXXXXXX */
export const MOBILE_REGEX = /^03\d{2}-\d{7}$/;

@ValidatorConstraint({ name: 'isPakistaniCnic', async: false })
export class IsPakistaniCnicConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && CNIC_REGEX.test(value);
  }
  defaultMessage() {
    return 'cnic must match format 35202-XXXXXXX-X';
  }
}

@ValidatorConstraint({ name: 'isPakistaniMobile', async: false })
export class IsPakistaniMobileConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown) {
    return typeof value === 'string' && MOBILE_REGEX.test(value);
  }
  defaultMessage() {
    return 'mobile must match format 03XX-XXXXXXX';
  }
}

export function IsPakistaniCnic(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsPakistaniCnicConstraint,
    });
  };
}

export function IsPakistaniMobile(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsPakistaniMobileConstraint,
    });
  };
}

export function assertValidCnic(cnic: string) {
  if (!CNIC_REGEX.test(cnic)) {
    throw new Error('Invalid CNIC format');
  }
}

export function assertValidMobile(mobile: string) {
  if (!MOBILE_REGEX.test(mobile)) {
    throw new Error('Invalid mobile format');
  }
}
