import type { Env } from "./env.js";

export interface AppConfig {
	port: number;
	apiKey: string;
	runtimeUrl: string;
	runtimeContainer: string;
	modelsDir: string;
	rateLimit: { windowMs: number; max: number };
}

export function buildConfig(env: Env): AppConfig {
	return {
		port: env.PORT,
		apiKey: env.API_KEY,
		runtimeUrl: env.LLAMA_RUNTIME_URL,
		runtimeContainer: env.LLAMA_RUNTIME_CONTAINER,
		modelsDir: env.MODELS_DIR,
		rateLimit: {
			windowMs: env.RATE_LIMIT_WINDOW_MS,
			max: env.RATE_LIMIT_MAX,
		},
	};
}
