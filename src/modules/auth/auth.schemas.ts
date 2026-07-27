import {z} from 'zod';
import {passwordSchema} from './password';

const nameSchema = z
  .string({error: 'Name is required'})
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must contain at most 100 characters');

const emailSchema = z
  .string({error: 'Enter a valid email address'})
  .trim()
  .max(254, 'Email must contain at most 254 characters')
  .email('Enter a valid email address');

export const registerSchema = z.strictObject({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.strictObject({
  email: z.string().max(254),
  password: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
};
