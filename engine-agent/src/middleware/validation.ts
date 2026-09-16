import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { BadRequestException } from "../common/exceptions/http-exception.js";

export function ValidationPipe(schema: ZodSchema) {
	return (req: Request, _res: Response, next: NextFunction) => {
		const result = schema.safeParse(req.body);
		if (!result.success) {
			const messages = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
			throw new BadRequestException(messages.join(", "));
		}
		req.body = result.data;
		next();
	};
}
