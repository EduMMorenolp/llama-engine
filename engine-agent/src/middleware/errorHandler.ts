import type { NextFunction, Request, Response } from "express";
import { HttpException } from "../common/exceptions/http-exception.js";
import { getConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
	if (err instanceof HttpException) {
		logger.warn(`HTTP ${err.statusCode}: ${err.message}`);
		res.status(err.statusCode).json({ error: err.message });
		return;
	}

	logger.error("Unhandled error:", err);

	const config = getConfig();
	const stack = config.NODE_ENV !== "production" ? err.stack : undefined;

	res.status(500).json({
		error: "Error interno del servidor",
		...(stack && { stack }),
	});
}
