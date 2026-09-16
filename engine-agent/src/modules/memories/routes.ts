import { Router } from "express";
import { ValidationPipe } from "../../middleware/validation.js";
import type { MemoryController } from "./controller.js";
import { createMemoryDto } from "./dto.js";

export function createMemoryRoutes(controller: MemoryController): Router {
	const router = Router();

	router.get("/", controller.list);
	router.post("/", ValidationPipe(createMemoryDto), controller.create);
	router.delete("/:key", controller.delete);

	return router;
}
