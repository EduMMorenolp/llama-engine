import type { NextFunction, Request, Response } from "express";
import type { AppConfig } from "../config.js";

/**
 * Auth por API key. Acepta `x-api-key` o `Authorization: Bearer <key>`.
 */
export function createAuthMiddleware(config: AppConfig) {
	return (req: Request, res: Response, next: NextFunction) => {
		const key =
			req.headers["x-api-key"] || req.headers.authorization?.toString().replace(/^Bearer\s+/i, "");
		if (!key || key !== config.apiKey) {
			return res.status(401).json({
				error: { message: "Unauthorized: API_KEY inválida", type: "authentication_error" },
			});
		}
		next();
	};
}
