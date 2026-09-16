import type { Env } from "./env.js";

export interface AppConfig {
	port: number;
	apiKey: string;
	runtimeUrl: string;
	runtimeContainer: string;
	modelsDir: string;
	rateLimit: { enabled: boolean; windowMs: number; max: number };
	hubUrl: string;
	hubToken: string;
	trainerUrl: string;
}

export function buildConfig(env: Env): AppConfig {
	return {
		port: env.PORT,
		apiKey: env.API_KEY,
		runtimeUrl: env.LLAMA_RUNTIME_URL,
		runtimeContainer: env.LLAMA_RUNTIME_CONTAINER,
		modelsDir: env.MODELS_DIR,
		rateLimit: {
			enabled: env.RATE_LIMIT_ENABLED,
			windowMs: env.RATE_LIMIT_WINDOW_MS,
			max: env.RATE_LIMIT_MAX,
		},
		hubUrl: env.HF_HUB_URL,
		hubToken: env.HF_TOKEN,
		trainerUrl: env.TRAINER_URL,
	};
}
