import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string(),
});

export const CreateItinerarySchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  isPublic: z.boolean().default(false),
});

export const UpdateItinerarySchema = CreateItinerarySchema.partial();

export const UpdateItineraryPublicSchema = z.object({
  isPublic: z.boolean(),
}).strict();

export const CreateEntrySchema = z.object({
  dayNumber: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  location: z.string().optional(),
  timeStart: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
  timeEnd: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
  category: z.enum(['accommodation', 'activity', 'meal', 'transport', 'other']).default('activity'),
  customDetails: z.record(z.any()).default({}),
});

export const UpdateEntrySchema = CreateEntrySchema.partial();

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateItineraryInput = z.infer<typeof CreateItinerarySchema>;
export type CreateEntryInput = z.infer<typeof CreateEntrySchema>;

