import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import type { AgentLoopConfig } from "../../agent/loop.js";
import { runAgent } from "../../agent/loop.js";
import type { SessionStore } from "../../sessions/store.js";
import { logger } from "../../utils/logger.js";

export function createChatHandler(agentConfig: AgentLoopConfig, store: SessionStore) {
	return async (req: Request, res: Response) => {
		const { sessionId: inputSessionId, message, model } = req.body ?? {};
		if (!message || typeof message !== "string") {
			res.status(400).json({ error: "message es requerido" });
			return;
		}

		const sessionId = inputSessionId ?? randomUUID();
		if (!store.getSession(sessionId)) {
			store.createSession(sessionId, undefined, model);
		}

		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");
		res.flushHeaders();

		try {
			await runAgent({ ...agentConfig, store }, { sessionId, message, model }, (event) => {
				res.write(`data: ${JSON.stringify(event)}\n\n`);
			});
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			logger.error("Agent error:", errorMessage);
			res.write(
				`data: ${JSON.stringify({ type: "error", payload: { message: errorMessage } })}\n\n`,
			);
		}

		res.end();
	};
}
