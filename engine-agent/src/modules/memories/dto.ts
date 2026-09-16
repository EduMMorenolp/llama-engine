import { z } from "zod";

export const createMemoryDto = z.object({
	key: z.string().min(1),
	content: z.string().min(1),
	tags: z.array(z.string()).default([]),
});

export const searchMemoryDto = z.object({
	q: z.string().default(""),
});

export type CreateMemoryDto = z.infer<typeof createMemoryDto>;
export type SearchMemoryDto = z.infer<typeof searchMemoryDto>;
