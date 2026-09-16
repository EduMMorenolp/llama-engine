import { Router } from "express";
import type { AgentLoopConfig } from "../../agent/loop.js";
import type { SessionStore } from "../../sessions/store.js";
import { createChatHandler } from "./handler.js";

export function createChatRoutes(agentConfig: AgentLoopConfig, store: SessionStore): Router {
	const router = Router();

	router.post("/", createChatHandler(agentConfig, store));

	return router;
}
