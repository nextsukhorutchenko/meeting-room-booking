import {describe, expect, it} from 'vitest';
import {normalizeEmail} from '../../src/modules/auth/email';

describe('normalizeEmail', () => {
  it('normalizes email before uniqueness and login checks', () => {
    expect(normalizeEmail('  Ada.Lovelace@Example.COM ')).toBe(
      'ada.lovelace@example.com',
    );
  });

  it('rejects blank input', () => {
    expect(() => normalizeEmail('   ')).toThrow();
  });
});
