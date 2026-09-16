import type { NextFunction, Request, Response } from "express";
import type { CreateSessionDto } from "./dto.js";
import type { SessionService } from "./service.js";

export class SessionController {
	constructor(private service: SessionService) {}

	create = (req: Request, res: Response, _next: NextFunction) => {
		const dto = req.body as CreateSessionDto;
		const session = this.service.createSession(dto);
		res.status(201).json(session);
	};

	getById = (req: Request, res: Response, _next: NextFunction) => {
		const id = String(req.params.id);
		const session = this.service.getSession(id);
		const messages = this.service.getMessages(id);
		res.json({ ...session, messages });
	};

	list = (_req: Request, res: Response, _next: NextFunction) => {
		const sessions = this.service.listSessions();
		res.json({ sessions });
	};

	delete = (req: Request, res: Response, _next: NextFunction) => {
		const id = String(req.params.id);
		const deleted = this.service.deleteSession(id);
		if (!deleted) {
			res.status(404).json({ error: "Sesión no encontrada" });
			return;
		}
		res.json({ ok: true });
	};
}
