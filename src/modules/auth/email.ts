import {z} from 'zod';

const emailSchema = z.string().trim().email();

export function normalizeEmail(email: string): string {
  return emailSchema.parse(email).toLowerCase();
}
