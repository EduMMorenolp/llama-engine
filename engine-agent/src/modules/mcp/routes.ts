import { Router } from "express";
import type { MCPController } from "./controller.js";

export function createMCPRoutes(controller: MCPController): Router {
	const router = Router();

	router.get("/servers", controller.listServers);
	router.post("/servers", controller.addServer);
	router.delete("/servers/:id", controller.deleteServer);
	router.post("/servers/:id/connect", controller.connectServer);
	router.post("/servers/:id/disconnect", controller.disconnectServer);

	return router;
}
