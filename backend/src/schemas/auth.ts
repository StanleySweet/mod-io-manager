import { z } from 'zod';

export const RegisterRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  nickname: z
    .string()
    .min(3, 'Nickname must be at least 3 characters')
    .max(32, 'Nickname must be at most 32 characters')
    .regex(/^[A-Za-z0-9_\-\.]+$/, 'Nickname can contain letters, numbers, _, -, .'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters long')
    .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least 1 number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least 1 special character'),
});

export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(12, 'Password must be at least 12 characters long')
    .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least 1 number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least 1 special character'),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordSchema>;
