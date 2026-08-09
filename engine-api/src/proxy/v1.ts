import type { IncomingMessage } from "node:http";
import http from "node:http";
import type { Request, Response } from "express";
import { Router } from "express";
import type { AppConfig } from "../config.js";

/**
 * Proxy transparente hacia la API OpenAI-compatible de llama-server.
 * Reenvía /v1/* (chat/completions, embeddings, models) al runtime con streaming SSE.
 */
export function createV1Proxy(config: AppConfig): Router {
	const router = Router();

	// GET /v1/models — lista de modelos del runtime
	router.get("/v1/models", async (_req, res) => {
		try {
			const up = await fetch(`${config.runtimeUrl}/v1/models`, {
				signal: AbortSignal.timeout(5000),
			});
			if (!up.ok) {
				res.status(502).json({ error: { message: `upstream ${up.status}` } });
				return;
			}
			res.setHeader("content-type", "application/json");
			res.send(await up.text());
		} catch (err) {
			writeUpstreamError(res, err);
		}
	});

	// Proxy del resto de /v1/*
	router.use("/v1", (req, res) => {
		// El runtime usa la misma ruta (el prefijo /v1 no se monta en un sub-path)
		proxyRequest(config, req, res);
	});

	return router;
}

function proxyRequest(config: AppConfig, req: Request, res: Response): void {
	const path = req.originalUrl; // ej: /v1/chat/completions
	const target = new URL(`${config.runtimeUrl}${path}`);

	const headers: Record<string, string | string[] | undefined> = {
		"content-type": req.headers["content-type"] ?? "application/json",
		accept: req.headers.accept ?? "application/json",
		authorization: req.headers.authorization,
		"x-api-key": req.headers["x-api-key"],
	};

	const upstreamReq = http.request(target, { method: req.method, headers }, (upstreamRes) => {
		res.statusCode = upstreamRes.statusCode ?? 502;
		res.setHeader("content-type", upstreamRes.headers["content-type"] ?? "application/json");
		res.setHeader("cache-control", upstreamRes.headers["cache-control"] ?? "no-store");
		upstreamRes.pipe(res);
	});

	upstreamReq.on("error", () => {
		if (!res.headersSent) {
			res.statusCode = 502;
			res.setHeader("content-type", "application/json");
		}
		res.end(JSON.stringify({ error: { message: "Runtime upstream error", type: "proxy_error" } }));
	});

	req.pipe(upstreamReq);
}

function writeUpstreamError(res: Response, err: unknown): void {
	const msg = err instanceof Error ? err.message : String(err);
	if (!res.headersSent) {
		res.statusCode = 502;
		res.setHeader("content-type", "application/json");
	}
	res.end(JSON.stringify({ error: { message: `Runtime error: ${msg}`, type: "proxy_error" } }));
}

export type { IncomingMessage };
