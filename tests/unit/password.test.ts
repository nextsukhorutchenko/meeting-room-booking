import {describe, expect, it} from 'vitest';
import {
  hashPassword,
  passwordSchema,
  verifyPassword,
} from '../../src/modules/auth/password';

describe('passwordSchema', () => {
  it('counts Unicode characters when enforcing the minimum length', () => {
    expect(passwordSchema.parse('1234567😀')).toBe('1234567😀');
  });

  it('rejects passwords outside the accepted length range', () => {
    expect(() => passwordSchema.parse('1234567')).toThrow();
    expect(() => passwordSchema.parse('a'.repeat(73))).toThrow();
  });

  it('returns false for a malformed password hash', async () => {
    await expect(
      verifyPassword('not-a-valid-argon2-hash', 'valid password'),
    ).resolves.toBe(false);
  });

  it('returns false for a too-short verification candidate', async () => {
    const hash = await hashPassword('valid password');

    await expect(verifyPassword(hash, '1234567')).resolves.toBe(false);
  });

  it('returns false for a too-long Unicode verification candidate', async () => {
    const hash = await hashPassword('valid password');
    const candidate = '😀'.repeat(73);

    expect(Array.from(candidate)).toHaveLength(73);
    await expect(verifyPassword(hash, candidate)).resolves.toBe(false);
  });

  it('returns true for a correct password and false for a mismatch', async () => {
    const hash = await hashPassword('valid password');

    await expect(verifyPassword(hash, 'valid password')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'other password')).resolves.toBe(false);
  });
});
