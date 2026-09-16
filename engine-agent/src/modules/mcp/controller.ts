import type { Request, Response } from "express";
import type { MCPManager } from "./manager.js";

export class MCPController {
	constructor(private mcpManager: MCPManager) {}

	listServers = async (_req: Request, res: Response): Promise<void> => {
		const servers = this.mcpManager.listServers();
		res.json({ servers });
	};

	addServer = async (req: Request, res: Response): Promise<void> => {
		const { name, transport = "stdio", command, args, url, env } = req.body;
		if (!name) {
			res.status(400).json({ error: "El nombre del servidor MCP es requerido" });
			return;
		}
		const server = this.mcpManager.addServer({ name, transport, command, args, url, env });
		res.status(201).json(server);
	};

	deleteServer = async (req: Request, res: Response): Promise<void> => {
		const { id } = req.params;
		const removed = await this.mcpManager.removeServer(id);
		if (!removed) {
			res.status(404).json({ error: "Servidor MCP no encontrado" });
			return;
		}
		res.json({ success: true });
	};

	connectServer = async (req: Request, res: Response): Promise<void> => {
		const { id } = req.params;
		try {
			const result = await this.mcpManager.connect(id);
			res.json(result);
		} catch (err: any) {
			res.status(500).json({ error: err.message });
		}
	};

	disconnectServer = async (req: Request, res: Response): Promise<void> => {
		const { id } = req.params;
		const result = await this.mcpManager.disconnect(id);
		res.json({ success: result });
	};
}
