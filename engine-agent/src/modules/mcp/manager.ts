import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { ToolRegistry } from "../../tools/registry.js";
import type { MCPServerConfig, MCPToolDefinition } from "./types.js";

interface ActiveProcess {
	process: ChildProcess;
	registeredTools: string[];
	pendingRequests: Map<
		number | string,
		{ resolve: (res: any) => void; reject: (err: any) => void }
	>;
	reqId: number;
}

export class MCPManager {
	private servers = new Map<string, MCPServerConfig>();
	private activeProcesses = new Map<string, ActiveProcess>();

	constructor(private toolRegistry: ToolRegistry) {
		// Initialize default presets
		this.addPresetServers();
	}

	private addPresetServers() {
		const presets: Omit<MCPServerConfig, "id" | "status">[] = [
			{
				name: "Memory Graph",
				transport: "stdio",
				command: "npx",
				args: ["-y", "@modelcontextprotocol/server-memory"],
			},
			{
				name: "Fetch & Web Search",
				transport: "stdio",
				command: "npx",
				args: ["-y", "@modelcontextprotocol/server-fetch"],
			},
			{
				name: "Filesystem MCP",
				transport: "stdio",
				command: "npx",
				args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
			},
		];

		for (const p of presets) {
			const id = randomUUID();
			this.servers.set(id, {
				id,
				...p,
				status: "disconnected",
				toolsCount: 0,
			});
		}
	}

	listServers(): MCPServerConfig[] {
		return Array.from(this.servers.values());
	}

	getServer(id: string): MCPServerConfig | undefined {
		return this.servers.get(id);
	}

	addServer(config: Omit<MCPServerConfig, "id" | "status">): MCPServerConfig {
		const id = randomUUID();
		const server: MCPServerConfig = {
			id,
			...config,
			status: "disconnected",
			toolsCount: 0,
		};
		this.servers.set(id, server);
		return server;
	}

	async removeServer(id: string): Promise<boolean> {
		if (this.activeProcesses.has(id)) {
			await this.disconnect(id);
		}
		return this.servers.delete(id);
	}

	async connect(id: string): Promise<{ success: boolean; tools: string[]; error?: string }> {
		const server = this.servers.get(id);
		if (!server) {
			throw new Error(`MCP Server con id "${id}" no encontrado`);
		}

		if (server.status === "connected") {
			const active = this.activeProcesses.get(id);
			return { success: true, tools: active?.registeredTools ?? [] };
		}

		if (server.transport !== "stdio" || !server.command) {
			server.status = "error";
			server.errorMessage = `Transporte ${server.transport} requiere un comando ejecutable válido`;
			return { success: false, tools: [], error: server.errorMessage };
		}

		try {
			const child = spawn(server.command, server.args ?? [], {
				env: { ...process.env, ...(server.env ?? {}) },
				shell: true,
			});

			const pendingRequests = new Map<
				number | string,
				{ resolve: (res: any) => void; reject: (err: any) => void }
			>();
			const active: ActiveProcess = {
				process: child,
				registeredTools: [],
				pendingRequests,
				reqId: 1,
			};

			let buffer = "";
			child.stdout?.on("data", (chunk: Buffer) => {
				buffer += chunk.toString("utf-8");
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed) continue;
					try {
						const json = JSON.parse(trimmed);
						if (json.id !== undefined && pendingRequests.has(json.id)) {
							const handler = pendingRequests.get(json.id)!;
							pendingRequests.delete(json.id);
							if (json.error) {
								handler.reject(new Error(json.error.message || JSON.stringify(json.error)));
							} else {
								handler.resolve(json.result);
							}
						}
					} catch {
						// Ignored non-JSON line
					}
				}
			});

			child.on("error", (err) => {
				server.status = "error";
				server.errorMessage = err.message;
				this.cleanupServer(id);
			});

			child.on("exit", () => {
				server.status = "disconnected";
				this.cleanupServer(id);
			});

			this.activeProcesses.set(id, active);

			const sendRpc = (method: string, params: Record<string, unknown> = {}): Promise<any> => {
				return new Promise((resolve, reject) => {
					const reqId = active.reqId++;
					const timeout = setTimeout(() => {
						if (pendingRequests.has(reqId)) {
							pendingRequests.delete(reqId);
							reject(new Error(`Timeout esperando respuesta de MCP server para ${method}`));
						}
					}, 15000);

					pendingRequests.set(reqId, {
						resolve: (res) => {
							clearTimeout(timeout);
							resolve(res);
						},
						reject: (err) => {
							clearTimeout(timeout);
							reject(err);
						},
					});

					const msg = JSON.stringify({
						jsonrpc: "2.0",
						id: reqId,
						method,
						params,
					});
					child.stdin?.write(`${msg}\n`);
				});
			};

			// Initialize handshake
			await sendRpc("initialize", {
				protocolVersion: "2024-11-05",
				capabilities: {},
				clientInfo: { name: "llama-engine-agent", version: "1.0.0" },
			});

			// Fetch tools list
			const toolsRes = await sendRpc("tools/list", {});
			const mcpTools: MCPToolDefinition[] = toolsRes?.tools ?? [];
			const toolNames: string[] = [];

			for (const mcpTool of mcpTools) {
				const toolName = `mcp_${server.name.toLowerCase().replace(/[^a-z0-9_]/g, "_")}_${mcpTool.name}`;
				this.toolRegistry.register(
					{
						type: "function",
						function: {
							name: toolName,
							description: mcpTool.description || `MCP tool ${mcpTool.name} from ${server.name}`,
							parameters: (mcpTool.inputSchema as any) || { type: "object", properties: {} },
						},
					},
					async (args) => {
						const callRes = await sendRpc("tools/call", {
							name: mcpTool.name,
							arguments: args,
						});
						if (callRes?.content) {
							if (Array.isArray(callRes.content)) {
								return callRes.content.map((c: any) => c.text ?? JSON.stringify(c)).join("\n");
							}
							return typeof callRes.content === "string"
								? callRes.content
								: JSON.stringify(callRes.content);
						}
						return JSON.stringify(callRes);
					},
					true,
				);

				active.registeredTools.push(toolName);
				toolNames.push(toolName);
			}

			server.status = "connected";
			server.toolsCount = toolNames.length;
			server.errorMessage = undefined;

			return { success: true, tools: toolNames };
		} catch (err: any) {
			server.status = "error";
			server.errorMessage = err.message;
			this.cleanupServer(id);
			return { success: false, tools: [], error: err.message };
		}
	}

	async disconnect(id: string): Promise<boolean> {
		const server = this.servers.get(id);
		const active = this.activeProcesses.get(id);
		if (active) {
			this.cleanupServer(id);
		}
		if (server) {
			server.status = "disconnected";
			server.toolsCount = 0;
			server.errorMessage = undefined;
		}
		return true;
	}

	private cleanupServer(id: string) {
		const active = this.activeProcesses.get(id);
		if (active) {
			for (const toolName of active.registeredTools) {
				this.toolRegistry.unregister(toolName);
			}
			try {
				active.process.kill();
			} catch {
				// Process might already be terminated
			}
			this.activeProcesses.delete(id);
		}
	}
}
