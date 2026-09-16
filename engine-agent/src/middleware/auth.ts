import type { NextFunction, Request, Response } from "express";
import { UnauthorizedException } from "../common/exceptions/http-exception.js";

export function createAuthMiddleware(apiKey: string) {
	return (req: Request, _res: Response, next: NextFunction) => {
		const key =
			(req.headers["x-api-key"] as string) ?? req.headers.authorization?.replace(/^Bearer /, "");
		if (key !== apiKey) {
			throw new UnauthorizedException("API key inválida o requerida");
		}
		next();
	};
}
