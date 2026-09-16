import cors from "cors";
import express, { type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { buildConfig } from "./config.js";
import { loadEnv } from "./env.js";
import { HuggingFaceHub } from "./hub/hf.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { ModelRegistry } from "./models/registry.js";
import { createV1Proxy } from "./proxy/v1.js";
import { RuntimeManager } from "./runtime/manager.js";
import { StatusService } from "./status/index.js";

/**
 * Expone solo vars LLAMA_* del contenedor. Nunca apiKey ni ninguna env que
 * contenga KEY / PASS / SECRET (defensa doble aunque el prefijo ya sea seguro).
 */
function sanitizeRuntimeEnv(env: Record<string, string>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(env)) {
		if (!k.startsWith("LLAMA_")) continue;
		if (/KEY|PASS|SECRET/i.test(k)) continue;
		out[k] = v;
	}
	return out;
}

async function bootstrap() {
	const env = loadEnv();
	const config = buildConfig(env);

	const registry = new ModelRegistry(config);
	const runtime = new RuntimeManager(config);
	const status = new StatusService(config, runtime, registry);
	const hub = new HuggingFaceHub(config);

	const app = express();
	app.set("trust proxy", 1);
	app.use(helmet());
	app.use(
		cors({
			origin: true, // refleja el origin del cliente: abierto para consumers locales/red
		}),
	);
	app.use(express.json({ limit: "50mb" }));

	if (config.rateLimit.enabled) {
		app.use(
			rateLimit({
				windowMs: config.rateLimit.windowMs,
				max: config.rateLimit.max,
				standardHeaders: true,
				legacyHeaders: false,
			}),
		);
	}

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

	// ---- Gestión del runtime ----
	app.get("/api/runtime/health", async (_req, res) => {
		const [running, healthy, loadedModel, ctxSize] = await Promise.all([
			runtime.isRunning(),
			status.isHealthy(),
			status.loadedModel(),
			status.ctxSize(),
		]);
		res.json({ running, healthy, loadedModel, ctxSize });
	});

	app.get("/api/runtime/config", async (_req, res) => {
		const runtimeEnv = sanitizeRuntimeEnv(await runtime.getEnv());
		res.json({
			engine: {
				port: config.port,
				runtimeUrl: config.runtimeUrl,
				runtimeContainer: config.runtimeContainer,
				modelsDir: config.modelsDir,
				rateLimit: config.rateLimit,
			},
			runtimeEnv,
		});
	});

	app.get("/api/runtime/logs", async (req, res) => {
		const tail = Number(req.query.tail);
		const raw = await runtime.logs(Number.isFinite(tail) ? tail : 100);
		const lines = raw.length ? raw.replace(/\r\n/g, "\n").split("\n") : [];
		res.json({ lines });
	});

	app.post("/api/runtime/stop", async (_req, res) => {
		const result = await runtime.stop();
		res.status(result.ok ? 200 : 500).json(result);
	});

	app.post("/api/runtime/start", async (_req, res) => {
		const result = await runtime.start();
		res.status(result.ok ? 200 : 500).json(result);
	});

	// ---- Datasets (proxy to trainer) ----
	app.get("/api/datasets", async (_req, res) => {
		try {
			const response = await fetch(`${config.trainerUrl}/api/datasets`);
			const data = await response.json();
			res.json(data);
		} catch {
			res.json({ datasets: [] });
		}
	});

	app.get("/api/datasets/:id/validate", async (req, res) => {
		try {
			const response = await fetch(`${config.trainerUrl}/api/datasets/${req.params.id}/validate`);
			const data = await response.json();
			res.json(data);
		} catch {
			res.status(502).json({ error: { message: "Trainer service unavailable" } });
		}
	});

	app.delete("/api/datasets/:id", async (req, res) => {
		try {
			const response = await fetch(`${config.trainerUrl}/api/datasets/${req.params.id}`, { method: "DELETE" });
			const data = await response.json();
			res.json(data);
		} catch {
			res.status(502).json({ error: { message: "Trainer service unavailable" } });
		}
	});

	// ---- Training (proxy to trainer) ----
	app.post("/api/train/start", async (req, res) => {
		try {
			const response = await fetch(`${config.trainerUrl}/api/train/start`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(req.body),
			});
			const data = await response.json();
			res.json(data);
		} catch {
			res.status(502).json({ error: { message: "Trainer service unavailable" } });
		}
	});

	app.get("/api/train/jobs", async (_req, res) => {
		try {
			const response = await fetch(`${config.trainerUrl}/api/train/jobs`);
			const data = await response.json();
			res.json(data);
		} catch {
			res.json({ jobs: [] });
		}
	});

	app.get("/api/train/jobs/:jobId", async (req, res) => {
		try {
			const response = await fetch(`${config.trainerUrl}/api/train/jobs/${req.params.jobId}`);
			const data = await response.json();
			res.json(data);
		} catch {
			res.status(502).json({ error: { message: "Trainer service unavailable" } });
		}
	});

	app.post("/api/train/jobs/:jobId/stop", async (req, res) => {
		try {
			const response = await fetch(`${config.trainerUrl}/api/train/jobs/${req.params.jobId}/stop`, { method: "POST" });
			const data = await response.json();
			res.json(data);
		} catch {
			res.status(502).json({ error: { message: "Trainer service unavailable" } });
		}
	});

	// ---- Quantize (proxy to trainer) ----
	app.get("/api/quantize/methods", async (_req, res) => {
		try {
			const response = await fetch(`${config.trainerUrl}/api/quantize/methods`);
			const data = await response.json();
			res.json(data);
		} catch {
			res.json({ methods: [] });
		}
	});

	app.post("/api/quantize", async (req, res) => {
		try {
			const response = await fetch(`${config.trainerUrl}/api/quantize`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(req.body),
			});
			const data = await response.json();
			res.json(data);
		} catch {
			res.status(502).json({ error: { message: "Trainer service unavailable" } });
		}
	});

	// ---- Deploy (local) ----
	app.post("/api/models/deploy", async (req, res) => {
		const { modelName, activate } = (req.body ?? {}) as { modelName?: string; activate?: boolean };
		if (!modelName) {
			res.status(400).json({ error: { message: "modelName es requerido" } });
			return;
		}
		const modelPath = `${config.modelsDir}/${modelName}.gguf`;
		const fs = await import("node:fs/promises");
		try {
			await fs.access(modelPath);
			res.json({ ok: true, message: `Modelo ${modelName} encontrado en ${config.modelsDir}` });
		} catch {
			res.status(404).json({ error: { message: `Modelo ${modelName} no encontrado en ${config.modelsDir}` } });
		}
	});

	// ---- Hugging Face Hub ----
	app.get("/api/hf/search", async (req, res) => {
		const q = String(req.query.q ?? "");
		try {
			const results = await hub.searchModels(q);
			res.json({ results });
		} catch (err) {
			respondHubError(res, err);
		}
	});

	app.get("/api/hf/repo/:owner/:name", async (req, res) => {
		const { owner, name } = req.params;
		try {
			const detail = await hub.repoDetail(owner, name);
			res.json(detail);
		} catch (err) {
			respondHubError(res, err);
		}
	});

	app.post("/api/hf/download", async (req, res) => {
		const { owner, name, file } = (req.body ?? {}) as {
			owner?: string;
			name?: string;
			file?: string;
		};
		if (!owner || !name || !file) {
			res.status(400).json({ error: { message: "owner, name y file son requeridos" } });
			return;
		}
		try {
			const result = await hub.downloadGGUF(owner, name, file);
			res.status(200).json({ ok: true, ...result, message: `"${result.id}" descargado` });
		} catch (err) {
			respondHubError(res, err);
		}
	});

	// ---- Proxy OpenAI /v1 (auth) ----
	app.use(requireAuth);
	app.use(createV1Proxy(config, registry));

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

function respondHubError(res: Response, err: unknown) {
	if (
		err instanceof Error &&
		"status" in err &&
		typeof (err as { status?: number }).status === "number"
	) {
		const status = (err as { status: number }).status;
		if (status === 404) {
			res.status(404).json({ error: { message: "No encontrado en el Hub" } });
			return;
		}
		res.status(502).json({ error: { message: err.message } });
		return;
	}
	console.error("[engine-api] hub error:", err);
	res.status(502).json({ error: { message: "Error consultando el Hub" } });
}
