import { Router } from "express";
import { ValidationPipe } from "../../middleware/validation.js";
import type { SessionController } from "./controller.js";
import { createSessionDto } from "./dto.js";

export function createSessionRoutes(controller: SessionController): Router {
	const router = Router();

	router.get("/", controller.list);
	router.post("/", ValidationPipe(createSessionDto), controller.create);
	router.get("/:id", controller.getById);
	router.delete("/:id", controller.delete);

	return router;
}
