import { afterEach, describe, expect, it, vi } from "vitest";
import {
	fetchSessions,
	createSession,
	updateSession,
	fetchSession,
	deleteSession,
	fetchTools,
	fetchHealth,
	fetchMCPServers,
	addMCPServer,
	deleteMCPServer,
	connectMCPServer,
	disconnectMCPServer,
	fetchAvailableModels,
} from "./api.ts";
import { AGENT_URL } from "./lib/api-client.ts";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

afterEach(() => {
	mockFetch.mockReset();
});

function mockResponse(data: unknown, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText: "OK",
		json: () => Promise.resolve(data),
	};
}

describe("api", () => {
	it("AGENT_URL has default value", () => {
		expect(AGENT_URL).toBeDefined();
		expect(AGENT_URL).toContain("http");
	});

	describe("fetchSessions", () => {
		it("returns sessions array", async () => {
			const sessions = [{ id: "s1", name: "Test", model: null, createdAt: 1, updatedAt: 1 }];
			mockFetch.mockResolvedValue(mockResponse({ sessions }));
			const result = await fetchSessions();
			expect(result).toEqual(sessions);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/api/sessions"),
				expect.objectContaining({ method: "GET" }),
			);
		});

		it("throws on non-ok response", async () => {
			mockFetch.mockResolvedValue(mockResponse({ error: "Unauthorized" }, 401));
			await expect(fetchSessions()).rejects.toThrow("Unauthorized");
		});
	});

	describe("createSession", () => {
		it("sends POST with body", async () => {
			const session = { id: "s2", name: "New", model: "qwen", createdAt: 1, updatedAt: 1 };
			mockFetch.mockResolvedValue(mockResponse(session));
			const result = await createSession("New", "qwen");
			expect(result).toEqual(session);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/api/sessions"),
				expect.objectContaining({ method: "POST" }),
			);
		});
	});

	describe("updateSession", () => {
		it("sends PATCH with body", async () => {
			const session = { id: "s1", name: "Updated", model: null, createdAt: 1, updatedAt: 2 };
			mockFetch.mockResolvedValue(mockResponse(session));
			const result = await updateSession("s1", { name: "Updated" });
			expect(result).toEqual(session);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/api/sessions/s1"),
				expect.objectContaining({ method: "PATCH" }),
			);
		});
	});

	describe("fetchSession", () => {
		it("returns session with messages", async () => {
			const data = { id: "s1", name: "T", model: null, createdAt: 1, updatedAt: 1, messages: [] };
			mockFetch.mockResolvedValue(mockResponse(data));
			const result = await fetchSession("s1");
			expect(result.messages).toEqual([]);
		});
	});

	describe("deleteSession", () => {
		it("sends DELETE", async () => {
			mockFetch.mockResolvedValue(mockResponse(undefined, 204));
			await deleteSession("s1");
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/api/sessions/s1"),
				expect.objectContaining({ method: "DELETE" }),
			);
		});
	});

	describe("fetchTools", () => {
		it("returns tools array", async () => {
			const tools = [{ name: "bash", description: "Bash", enabled: true }];
			mockFetch.mockResolvedValue(mockResponse({ tools }));
			const result = await fetchTools();
			expect(result).toEqual(tools);
		});

		it("throws on error", async () => {
			mockFetch.mockResolvedValue(mockResponse({ error: "Not found" }, 404));
			await expect(fetchTools()).rejects.toThrow("Not found");
		});
	});

	describe("fetchHealth", () => {
		it("returns health status", async () => {
			const health = { status: "ok", agentRunning: true };
			mockFetch.mockResolvedValue(mockResponse(health));
			const result = await fetchHealth();
			expect(result).toEqual(health);
		});
	});

	describe("fetchMCPServers", () => {
		it("returns servers array", async () => {
			const servers = [{ id: "m1", name: "test", transport: "stdio", status: "disconnected" }];
			mockFetch.mockResolvedValue(mockResponse({ servers }));
			const result = await fetchMCPServers();
			expect(result).toEqual(servers);
		});
	});

	describe("addMCPServer", () => {
		it("sends POST with server config", async () => {
			const server = { id: "m2", name: "new", transport: "stdio", status: "disconnected" };
			mockFetch.mockResolvedValue(mockResponse(server));
			const result = await addMCPServer({ name: "new", transport: "stdio" });
			expect(result).toEqual(server);
		});
	});

	describe("deleteMCPServer", () => {
		it("sends DELETE", async () => {
			mockFetch.mockResolvedValue(mockResponse(undefined, 204));
			await deleteMCPServer("m1");
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/api/mcp/servers/m1"),
				expect.objectContaining({ method: "DELETE" }),
			);
		});
	});

	describe("connectMCPServer", () => {
		it("sends POST to connect", async () => {
			const res = { success: true, tools: ["tool1"] };
			mockFetch.mockResolvedValue(mockResponse(res));
			const result = await connectMCPServer("m1");
			expect(result).toEqual(res);
		});
	});

	describe("disconnectMCPServer", () => {
		it("sends POST to disconnect", async () => {
			const res = { success: true };
			mockFetch.mockResolvedValue(mockResponse(res));
			const result = await disconnectMCPServer("m1");
			expect(result).toEqual(res);
		});
	});

	describe("fetchAvailableModels", () => {
		it("returns models list", async () => {
			const data = { models: [{ id: "qwen", name: "Qwen" }], activeModel: "qwen" };
			mockFetch.mockResolvedValue(mockResponse(data));
			const result = await fetchAvailableModels();
			expect(result.models).toHaveLength(1);
			expect(result.activeModel).toBe("qwen");
		});
	});
});
