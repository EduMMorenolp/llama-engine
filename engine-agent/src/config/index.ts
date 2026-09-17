import { z } from "zod";
import "dotenv/config";

const envSchema = z
	.object({
		AGENT_PORT: z.coerce.number().default(3060),
		HOST: z.string().default("localhost"),
		NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
		ENGINE_API_URL: z.string().url().default("http://localhost:3050"),
		ENGINE_API_KEY: z.string().optional(),
		TELEGRAM_BOT_TOKEN: z.string().default(""),
		TELEGRAM_ALLOWED_USERS: z.string().default(""),
		DB_PATH: z.string().default("./data/agent.db"),
		MAX_ITERATIONS: z.coerce.number().default(10),
		SYSTEM_PROMPT: z.string().default("Sos un asistente de IA inteligente, empático y servicial."),
	})
	.refine((data) => data.ENGINE_API_KEY && data.ENGINE_API_KEY.length > 0, {
		message: "ENGINE_API_KEY es requerida",
		path: ["ENGINE_API_KEY"],
	});

export type EnvConfig = z.infer<typeof envSchema>;

let _config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
	if (_config) return _config;
	const result = envSchema.safeParse(process.env);
	if (!result.success) {
		const msg = result.error.issues.map((i) => i.message).join(", ");
		throw new Error(msg);
	}
	_config = result.data as EnvConfig;
	return _config;
}

export function resetConfig(): void {
	_config = null;
}
