import { Router } from "express";
import type { Database } from "sql.js";
import type { AgentLoopConfig } from "../agent/loop.js";
import { createChatRoutes } from "../modules/chat/routes.js";
import { MemoryController } from "../modules/memories/controller.js";
import { createMemoryRoutes } from "../modules/memories/routes.js";
import { MemoryService } from "../modules/memories/service.js";
import { SessionController } from "../modules/sessions/controller.js";
import { createSessionRoutes } from "../modules/sessions/routes.js";
import { SessionService } from "../modules/sessions/service.js";
import { ToolController } from "../modules/tools/controller.js";
import { createToolRoutes } from "../modules/tools/routes.js";
import { ToolService } from "../modules/tools/service.js";
import type { SessionStore } from "../sessions/store.js";
import type { ToolRegistry } from "../tools/registry.js";

export function createApiRoutes(
	db: Database,
	store: SessionStore,
	toolRegistry: ToolRegistry,
	agentConfig: AgentLoopConfig,
) {
	const router = Router();

	const sessionService = new SessionService(db);
	const sessionController = new SessionController(sessionService);
	router.use("/sessions", createSessionRoutes(sessionController));

	const memoryService = new MemoryService(db);
	const memoryController = new MemoryController(memoryService);
	router.use("/memories", createMemoryRoutes(memoryController));

	const toolService = new ToolService(toolRegistry);
	const toolController = new ToolController(toolService);
	router.use("/tools", createToolRoutes(toolController));

	router.use("/chat", createChatRoutes(agentConfig, store));

	return router;
}
