import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
	PORT: z.coerce.number().default(3050),
	API_KEY: z.string().min(1, "API_KEY es requerida"),
	LLAMA_RUNTIME_URL: z.string().url().default("http://llama-runtime:8080"),
	LLAMA_RUNTIME_CONTAINER: z.string().default("llama-runtime"),
	MODELS_DIR: z.string().default("/models"),
	RATE_LIMIT_ENABLED: z
		.string()
		.default("true")
		.transform((v) => v.toLowerCase() !== "false"),
	RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000),
	RATE_LIMIT_MAX: z.coerce.number().default(1_000),
	HF_TOKEN: z.string().default(""),
	HF_HUB_URL: z.string().url().default("https://huggingface.co"),
	TRAINER_URL: z.string().url().default("http://llama-trainer:8081"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
	const parsed = envSchema.safeParse(process.env);
	if (!parsed.success) {
		const details = parsed.error.issues
			.map((i) => `  - ${i.path.join(".")}: ${i.message}`)
			.join("\n");
		console.error(`[env] Config inválida:\n${details}`);
		throw new Error("Variables de entorno inválidas");
	}
	return parsed.data;
}
