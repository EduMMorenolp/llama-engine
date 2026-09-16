import type { NextFunction, Request, Response } from "express";
import type { MemoryService } from "./service.js";

export class MemoryController {
	constructor(private service: MemoryService) {}

	list = (req: Request, res: Response, _next: NextFunction) => {
		const q = String(req.query.q ?? "");
		const memories = this.service.search(q);
		res.json({ memories });
	};

	create = (req: Request, res: Response, _next: NextFunction) => {
		const { key, content, tags } = req.body;
		const memory = this.service.upsert(key, content, tags ?? []);
		res.status(201).json(memory);
	};

	delete = (req: Request, res: Response, _next: NextFunction) => {
		const key = String(req.params.key);
		const deleted = this.service.delete(key);
		if (!deleted) {
			res.status(404).json({ error: "Memoria no encontrada" });
			return;
		}
		res.json({ ok: true });
	};
}
