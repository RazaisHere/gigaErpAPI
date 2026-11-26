import {
  COGNITO_PASSWORD_REQUIREMENTS_MESSAGE,
  formatCognitoPasswordError,
  passwordMeetsCognitoPolicy,
} from './cognito-password.policy';

describe('cognito-password.policy', () => {
  it('accepts passwords matching pool policy', () => {
    expect(passwordMeetsCognitoPolicy('Num123456@@@')).toBe(true);
    expect(passwordMeetsCognitoPolicy('Workspace@123')).toBe(true);
  });

  it('rejects missing uppercase, number, or special', () => {
    expect(passwordMeetsCognitoPolicy('num123456@@@')).toBe(false); // no upper
    expect(passwordMeetsCognitoPolicy('Num@@@@@@@')).toBe(false); // no number
    expect(passwordMeetsCognitoPolicy('Num1234567')).toBe(false); // no special
    expect(passwordMeetsCognitoPolicy('N1@')).toBe(false); // too short
  });

  it('formats Cognito errors into requirement list', () => {
    const msg = formatCognitoPasswordError(
      'Password did not conform with policy: Password must have numeric characters',
    );
    expect(msg).toContain('1 number');
    expect(msg).toContain(COGNITO_PASSWORD_REQUIREMENTS_MESSAGE);
  });
});
