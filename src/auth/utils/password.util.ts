import * as bcrypt from 'bcrypt';

/** PHP bcrypt uses $2y$; Node bcrypt expects $2b$ (same algorithm). */
export function normalizeBcryptHash(hash: string): string {
  return hash.startsWith('$2y$') ? `$2b$${hash.slice(4)}` : hash;
}

const DUMMY_HASH =
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G2oQ.5qKxqKxqK';

export async function verifyPassword(
  plain: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  const hash = storedHash ? normalizeBcryptHash(storedHash) : DUMMY_HASH;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
