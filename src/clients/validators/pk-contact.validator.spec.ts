import { CNIC_REGEX, MOBILE_REGEX } from './pk-contact.validator';

describe('pk-contact validators', () => {
  it('accepts valid CNIC', () => {
    expect(CNIC_REGEX.test('35202-1234567-1')).toBe(true);
  });

  it('rejects invalid CNIC', () => {
    expect(CNIC_REGEX.test('35202-1234567')).toBe(false);
    expect(CNIC_REGEX.test('abc')).toBe(false);
  });

  it('accepts valid mobile', () => {
    expect(MOBILE_REGEX.test('0300-1234567')).toBe(true);
  });

  it('rejects invalid mobile', () => {
    expect(MOBILE_REGEX.test('0341 5813388')).toBe(false);
    expect(MOBILE_REGEX.test('300-1234567')).toBe(false);
  });
});
