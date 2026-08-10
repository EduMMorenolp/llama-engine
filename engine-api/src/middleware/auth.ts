import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { AppConfig } from "../config.js";

/**
 * Auth por API key. Acepta `x-api-key` o `Authorization: Bearer <key>`.
 * Comparación de tiempo constante para evitar timing attacks.
 */
export function createAuthMiddleware(config: AppConfig) {
	const expected = Buffer.from(config.apiKey);
	return (req: Request, res: Response, next: NextFunction) => {
		const raw =
			req.headers["x-api-key"] ?? req.headers.authorization?.toString().replace(/^Bearer\s+/i, "");
		const keyVal = Array.isArray(raw) ? raw[0] : raw;
		const key = Buffer.from(keyVal ?? "");
		if (
			key.length === 0 ||
			expected.length === 0 ||
			key.length !== expected.length ||
			!timingSafeEqual(key, expected)
		) {
			return res.status(401).json({
				error: { message: "Unauthorized: API_KEY inválida", type: "authentication_error" },
			});
		}
		next();
	};
}
