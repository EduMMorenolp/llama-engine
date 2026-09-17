import { z } from "zod";

export const createSessionDto = z.object({
	id: z.string().optional(),
	name: z.string().optional().nullable(),
	model: z.string().optional().nullable(),
});

export const updateSessionDto = z.object({
	name: z.string().optional().nullable(),
	model: z.string().optional().nullable(),
});

export type CreateSessionDto = z.infer<typeof createSessionDto>;
export type UpdateSessionDto = z.infer<typeof updateSessionDto>;
