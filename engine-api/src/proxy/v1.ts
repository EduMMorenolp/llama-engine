import type { IncomingMessage } from "node:http";
import http from "node:http";
import type { Request, Response } from "express";
import { Router } from "express";
import type { AppConfig } from "../config.js";
import type { ModelRegistry } from "../models/registry.js";
import type { StatusService } from "../status/index.js";

/**
 * Proxy transparente hacia la API OpenAI-compatible de llama-server.
 * Reenvía /v1/* (chat/completions, embeddings, models) al runtime con streaming SSE
 * y registra métricas de velocidad (tok/s) en vivo en StatusService.
 */
export function createV1Proxy(
	config: AppConfig,
	registry: ModelRegistry,
	statusService?: StatusService,
): Router {
	const router = Router();

	// GET /v1/models — todos los modelos del registro en formato OpenAI
	router.get("/v1/models", (_req, res) => {
		const models = registry.list();
		res.json({
			object: "list",
			data: models.map((m) => ({
				id: m.id,
				object: "model" as const,
				created: Math.floor(Date.now() / 1000),
				owned_by: "llama-engine",
			})),
		});
	});

	// Proxy del resto de /v1/*
	router.use("/v1", (req, res) => {
		proxyRequest(config, req, res, statusService);
	});

	return router;
}

function proxyRequest(
	config: AppConfig,
	req: Request,
	res: Response,
	statusService?: StatusService,
): void {
	const path = req.originalUrl;
	const target = new URL(`${config.runtimeUrl}${path}`);

	const headers: Record<string, string | string[] | undefined> = stripUpstreamCredentials(
		req.headers,
	);

	let payload: Buffer | null = null;
	let requestedModel = "";
	if (req.body != null) {
		if (!Buffer.isBuffer(req.body) && typeof req.body === "object") {
			requestedModel = String((req.body as { model?: string }).model ?? "");
		}
		payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body), "utf8");
		headers["content-length"] = String(payload.length);
	}

	const startedAt = Date.now();
	let firstTokenAt: number | null = null;
	let sseEvents = 0;

	const upstreamReq = http.request(target, { method: req.method, headers }, (upstreamRes) => {
		res.statusCode = upstreamRes.statusCode ?? 502;
		const contentType = upstreamRes.headers["content-type"] ?? "application/json";
		res.setHeader("content-type", contentType);
		res.setHeader("cache-control", upstreamRes.headers["cache-control"] ?? "no-store");

		if (statusService && contentType.includes("text/event-stream")) {
			upstreamRes.on("data", (chunk: Buffer) => {
				const text = chunk.toString("utf8");
				const matches = text.match(/data:\s*\{/g);
				if (matches && matches.length > 0) {
					const now = Date.now();
					if (firstTokenAt === null) firstTokenAt = now;
					sseEvents += matches.length;
					const genSec = Math.max(0.15, (now - firstTokenAt) / 1000);
					const prefillSec = Math.max(0.05, (firstTokenAt - startedAt) / 1000);
					statusService.recordInferencePulse({
						model: requestedModel,
						promptN: Math.max(16, Math.round((payload?.length ?? 64) / 4)),
						predictedN: sseEvents,
						promptPerSec: Number(
							(Math.max(16, (payload?.length ?? 64) / 4) / prefillSec).toFixed(1),
						),
						predictedPerSec: Number((sseEvents / genSec).toFixed(1)),
					});
				}
			});
		}

		upstreamRes.pipe(res);
	});

	upstreamReq.on("error", () => {
		if (!res.headersSent) {
			res.statusCode = 502;
			res.setHeader("content-type", "application/json");
		}
		res.end(JSON.stringify({ error: { message: "Runtime upstream error", type: "proxy_error" } }));
	});

	if (payload) upstreamReq.write(payload);
	upstreamReq.end();
}

/**
 * Copia de los headers del request dejando fuera las credenciales del cliente
 * (authorization / x-api-key).
 */
export function stripUpstreamCredentials(
	headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
	const stripped: Record<string, string | string[] | undefined> = {
		"content-type": headers["content-type"] ?? "application/json",
		accept: headers.accept ?? "application/json",
	};
	if (headers["content-length"]) {
		stripped["content-length"] = headers["content-length"];
	}
	return stripped;
}

export type { IncomingMessage };
