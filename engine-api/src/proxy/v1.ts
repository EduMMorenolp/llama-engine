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

	// No reenviar credenciales del cliente al upstream (el runtime no las necesita).
	const headers: Record<string, string | string[] | undefined> = stripUpstreamCredentials(
		req.headers,
	);

	// express.json() ya consumió el stream del request, así que re-emitimos el body
	// desde req.body con content-length explícito (el runtime no parsea chunked).
	let payload: Buffer | null = null;
	if (req.body != null) {
		payload = Buffer.isBuffer(req.body)
			? req.body
			: Buffer.from(JSON.stringify(req.body), "utf8");
		headers["content-length"] = String(payload.length);
	}

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

	if (payload) upstreamReq.write(payload);
	upstreamReq.end();
}

function writeUpstreamError(res: Response, err: unknown): void {
	const msg = err instanceof Error ? err.message : String(err);
	if (!res.headersSent) {
		res.statusCode = 502;
		res.setHeader("content-type", "application/json");
	}
	res.end(JSON.stringify({ error: { message: `Runtime error: ${msg}`, type: "proxy_error" } }));
}

/**
 * Copia de los headers del request dejando fuera las credenciales del cliente
 * (authorization / x-api-key). El runtime llama-server no las necesita y reenviarlas
 * fuga la API key del cliente hacia el upstream.
 */
export function stripUpstreamCredentials(
	headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
	const stripped: Record<string, string | string[] | undefined> = {
		"content-type": headers["content-type"] ?? "application/json",
		accept: headers.accept ?? "application/json",
	};
	// Preservar content-length: reenviamos el body tal cual via pipe, así el
	// runtime recibe el body completo en lugar de chunked (llama-server no lo parsea).
	if (headers["content-length"]) {
		stripped["content-length"] = headers["content-length"];
	}
	return stripped;
}

export type { IncomingMessage };
