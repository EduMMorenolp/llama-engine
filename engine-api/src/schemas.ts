import { z } from "zod";

const SAFE_ID_REGEX = /^[a-zA-Z0-9._-]+$/;

export const reloadBodySchema = z.object({
	modelId: z
		.string({ required_error: "modelId es requerido" })
		.trim()
		.min(1, "modelId es requerido")
		.regex(SAFE_ID_REGEX, "modelId contiene caracteres inválidos"),
	ctxSize: z
		.preprocess(
			(val) => (val === 0 || val === "" || val === null ? undefined : val),
			z.coerce.number().int().min(512).max(262_144).optional(),
		)
		.optional(),
	cacheTypeK: z.enum(["f16", "q8_0", "q4_0", "q4_1", "q5_0", "q5_1"]).optional(),
	cacheTypeV: z.enum(["f16", "q8_0", "q4_0", "q4_1", "q5_0", "q5_1"]).optional(),
	parallel: z.coerce.number().int().min(1).max(32).optional(),
	threads: z.coerce.number().int().min(1).max(128).optional(),
	flashAttn: z.enum(["on", "off", "auto"]).optional(),
	chatTemplate: z
		.string()
		.trim()
		.max(64)
		.regex(/^[a-zA-Z0-9._-]*$/, "chatTemplate inválido")
		.optional(),
	gpuLayers: z.coerce.number().int().min(0).max(999).optional(),
	batchSize: z.coerce.number().int().min(32).max(16_384).optional(),
	ubatchSize: z.coerce.number().int().min(32).max(16_384).optional(),
});

export type ReloadOptions = Omit<z.infer<typeof reloadBodySchema>, "modelId">;

export const deployBodySchema = z.object({
	modelName: z
		.string({ required_error: "modelName es requerido" })
		.trim()
		.min(1, "modelName es requerido")
		.regex(SAFE_ID_REGEX, "modelName contiene caracteres inválidos"),
	activate: z.boolean().optional().default(false),
});

export const hfDownloadBodySchema = z.object({
	owner: z
		.string({ required_error: "owner es requerido" })
		.trim()
		.min(1, "owner es requerido")
		.regex(SAFE_ID_REGEX, "owner inválido"),
	name: z
		.string({ required_error: "name es requerido" })
		.trim()
		.min(1, "name es requerido")
		.regex(SAFE_ID_REGEX, "name inválido"),
	file: z.string({ required_error: "file es requerido" }).trim().min(1, "file es requerido"),
	async: z.boolean().optional().default(false),
});

export const trainStartBodySchema = z.object({
	baseModelId: z
		.string({ required_error: "baseModelId es requerido" })
		.trim()
		.min(1, "baseModelId es requerido"),
	datasetId: z
		.string({ required_error: "datasetId es requerido" })
		.trim()
		.min(1, "datasetId es requerido")
		.regex(SAFE_ID_REGEX, "datasetId inválido"),
	method: z.enum(["qlora", "lora", "full"]).default("qlora"),
	epochs: z.coerce.number().int().min(1).max(100).default(3),
	learningRate: z.coerce.number().positive().max(1).default(2e-4),
	rank: z.coerce.number().int().min(4).max(256).default(64),
	batchSize: z.coerce.number().int().min(1).max(128).default(4),
	maxSeqLen: z.coerce.number().int().min(128).max(131_072).default(2048),
});

export const quantizeBodySchema = z.object({
	modelId: z
		.string({ required_error: "modelId es requerido" })
		.trim()
		.min(1, "modelId es requerido")
		.regex(SAFE_ID_REGEX, "modelId inválido"),
	method: z.enum(["Q3_K_M", "Q4_K_M", "Q5_K_M", "Q6_K", "Q8_0", "F16"]).default("Q4_K_M"),
	imatrix: z.boolean().optional().default(false),
});

export function formatZodError(error: z.ZodError): string {
	return error.issues
		.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
		.join("; ");
}
