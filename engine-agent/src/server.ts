import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { Database } from "sql.js";
import type { AgentLoopConfig } from "./agent/loop.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createApiRoutes } from "./routes/index.js";
import type { SessionStore } from "./sessions/store.js";
import type { ToolRegistry } from "./tools/registry.js";

export interface ServerConfig {
	port: number;
	apiKey: string;
}

export function createApp(
	serverConfig: ServerConfig,
	db: Database,
	store: SessionStore,
	toolRegistry: ToolRegistry,
	agentConfig: AgentLoopConfig,
) {
	const app = express();
	app.set("trust proxy", 1);
	app.use(helmet());
	app.use(cors({ origin: true }));
	app.use(express.json());

	app.get("/api/health", (_req, res) => {
		res.json({ status: "ok", agentRunning: true });
	});

	const authMiddleware = createAuthMiddleware(serverConfig.apiKey);
	app.use("/api", authMiddleware, createApiRoutes(db, store, toolRegistry, agentConfig));

	app.use(errorHandler);

	return app;
}
