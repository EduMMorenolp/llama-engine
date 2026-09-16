import { describe, expect, it } from "vitest";
import { ToolRegistry } from "../../tools/registry.js";
import { MCPManager } from "./manager.js";

describe("MCPManager", () => {
	it("initializes with default preset servers", () => {
		const registry = new ToolRegistry();
		const manager = new MCPManager(registry);
		const servers = manager.listServers();
		expect(servers.length).toBeGreaterThanOrEqual(3);
		expect(servers.some((s) => s.name === "Memory Graph")).toBe(true);
	});

	it("adds and removes custom MCP server", async () => {
		const registry = new ToolRegistry();
		const manager = new MCPManager(registry);
		const server = manager.addServer({
			name: "Test Server",
			transport: "stdio",
			command: "node",
			args: ["-e", "console.log('hi')"],
		});

		expect(server.id).toBeDefined();
		expect(server.name).toBe("Test Server");
		expect(manager.getServer(server.id)).toBeDefined();

		const removed = await manager.removeServer(server.id);
		expect(removed).toBe(true);
		expect(manager.getServer(server.id)).toBeUndefined();
	});
});
