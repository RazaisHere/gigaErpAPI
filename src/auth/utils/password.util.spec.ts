import { normalizeBcryptHash, verifyPassword } from './password.util';

describe('password.util', () => {
  it('rewrites $2y$ hashes to $2b$ for Node bcrypt', () => {
    const php =
      '$2y$12$CdckeeO/X0WTXWLohMo7juAhG4g1mj6mzpnPDwu5CBd5nvdzCanYu';
    expect(normalizeBcryptHash(php).startsWith('$2b$')).toBe(true);
    expect(normalizeBcryptHash(php).slice(4)).toBe(php.slice(4));
  });

  it('verifies the seeded Workspace@123 hash', async () => {
    const php =
      '$2y$12$CdckeeO/X0WTXWLohMo7juAhG4g1mj6mzpnPDwu5CBd5nvdzCanYu';
    await expect(verifyPassword('Workspace@123', php)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', php)).resolves.toBe(false);
  });

  it('returns false for missing hash without throwing', async () => {
    await expect(verifyPassword('anything', null)).resolves.toBe(false);
  });
});
