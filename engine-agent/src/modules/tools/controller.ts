import type { NextFunction, Request, Response } from "express";
import type { ToolService } from "./service.js";

export class ToolController {
	constructor(private service: ToolService) {}

	list = (_req: Request, res: Response, _next: NextFunction) => {
		const tools = this.service.list();
		res.json({ tools });
	};

	delete = (req: Request, res: Response, _next: NextFunction) => {
		const name = String(req.params.name);
		const deleted = this.service.unregister(name);
		if (!deleted) {
			res.status(404).json({ error: "Tool no encontrado" });
			return;
		}
		res.json({ ok: true });
	};
}
