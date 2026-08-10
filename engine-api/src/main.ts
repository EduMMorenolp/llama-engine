import cors from "cors";
import express, { type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { buildConfig } from "./config.js";
import { loadEnv } from "./env.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { ModelRegistry } from "./models/registry.js";
import { createV1Proxy } from "./proxy/v1.js";
import { RuntimeManager } from "./runtime/manager.js";
import { StatusService } from "./status/index.js";

async function bootstrap() {
	const env = loadEnv();
	const config = buildConfig(env);

	const registry = new ModelRegistry(config);
	const runtime = new RuntimeManager(config);
	const status = new StatusService(config, runtime, registry);

	const app = express();
	app.set("trust proxy", 1);
	app.use(helmet());
	app.use(
		cors({
			origin: true, // refleja el origin del cliente: abierto para consumers locales/red
		}),
	);
	app.use(express.json({ limit: "50mb" }));

	const limiter = rateLimit({
		windowMs: config.rateLimit.windowMs,
		max: config.rateLimit.max,
		standardHeaders: true,
		legacyHeaders: false,
	});
	app.use(limiter);

	const requireAuth = createAuthMiddleware(config);

	// ---- Health (público) ----
	app.get("/api/health", async (_req, res) => {
		const running = await runtime.isRunning();
		res.json({ status: running ? "ok" : "degraded", runtimeRunning: running });
	});

	// ---- Gestión (auth) ----
	app.use("/api", requireAuth);

	app.get("/api/status", async (_req, res) => {
		res.json(await status.status());
	});

	app.get("/api/models", (_req, res) => {
		res.json({ models: registry.list() });
	});

	app.post("/api/models/reload", async (req, res) => {
		const modelId = String(req.body?.modelId ?? "");
		const ctxSize = Number(req.body?.ctxSize ?? 0) || undefined;
		if (!modelId) {
			res.status(400).json({ error: { message: "modelId es requerido" } });
			return;
		}
		if (!registry.get(modelId)) {
			res.status(404).json({ error: { message: `Modelo "${modelId}" no registrado` } });
			return;
		}
		const result = await runtime.reload(modelId, ctxSize ? { ctxSize } : {});
		res.status(result.ok ? 200 : 500).json(result);
	});

	app.post("/api/runtime/restart", async (_req, res) => {
		const result = await runtime.restart();
		res.status(result.ok ? 200 : 500).json(result);
	});

	// ---- Proxy OpenAI /v1 (auth) ----
	app.use(requireAuth);
	app.use(createV1Proxy(config));

	// ---- Not found + error ----
	app.use((_req, res) => {
		res.status(404).json({ error: { message: "not_found" } });
	});
	app.use((err: unknown, _req: Request, res: Response, _next: unknown) => {
		console.error("[engine-api] error:", err);
		res.status(500).json({ error: { message: "Internal server error" } });
	});

	app.listen(config.port, () => {
		console.log(`[engine-api] escuchando en :${config.port}`);
		console.log(`[engine-api] runtime: ${config.runtimeUrl} (${config.runtimeContainer})`);
	});
}

bootstrap().catch((err) => {
	console.error("[engine-api] fatal:", err);
	process.exit(1);
});
