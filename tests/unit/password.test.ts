import {describe, expect, it} from 'vitest';
import {passwordSchema} from '../../src/modules/auth/password';

describe('passwordSchema', () => {
  it('counts Unicode characters when enforcing the minimum length', () => {
    expect(passwordSchema.parse('1234567😀')).toBe('1234567😀');
  });

  it('rejects passwords outside the accepted length range', () => {
    expect(() => passwordSchema.parse('1234567')).toThrow();
    expect(() => passwordSchema.parse('a'.repeat(73))).toThrow();
  });
});
