import { z } from "zod";

export const createSessionDto = z.object({
	name: z.string().min(1).optional(),
	model: z.string().min(1).optional(),
});

export const updateSessionDto = z.object({
	name: z.string().min(1).optional(),
	model: z.string().min(1).optional(),
});

export type CreateSessionDto = z.infer<typeof createSessionDto>;
export type UpdateSessionDto = z.infer<typeof updateSessionDto>;
