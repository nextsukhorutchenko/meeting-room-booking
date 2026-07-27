import argon2 from 'argon2';
import {z} from 'zod';

function unicodeCharacterCount(value: string): number {
  return Array.from(value).length;
}

export const passwordSchema = z.string().superRefine((value, context) => {
  const length = unicodeCharacterCount(value);
  if (length < 8 || length > 72) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must contain 8 to 72 Unicode characters',
    });
  }
});

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(passwordSchema.parse(password), {
    type: argon2.argon2id,
  });
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  const candidate = passwordSchema.safeParse(password);
  if (!candidate.success) {
    return false;
  }

  try {
    return await argon2.verify(hash, candidate.data);
  } catch {
    return false;
  }
}
