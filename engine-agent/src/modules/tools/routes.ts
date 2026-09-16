import { Router } from "express";
import type { ToolController } from "./controller.js";

export function createToolRoutes(controller: ToolController): Router {
	const router = Router();

	router.get("/", controller.list);
	router.delete("/:name", controller.delete);

	return router;
}
