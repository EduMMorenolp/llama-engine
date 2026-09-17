import { describe, expect, it, vi } from "vitest";
import { createChatHandler } from "./handler.js";

function mockReq(body: any) {
	return { body } as any;
}

function mockRes() {
	const res: any = {};
	res.status = vi.fn().mockReturnValue(res);
	res.json = vi.fn().mockReturnValue(res);
	res.setHeader = vi.fn();
	res.flushHeaders = vi.fn();
	res.write = vi.fn();
	res.end = vi.fn();
	return res;
}

function createMockStore(sessionExists = false) {
	return {
		getSession: vi.fn().mockReturnValue(sessionExists ? { id: "s1" } : null),
		createSession: vi.fn().mockReturnValue({ id: "s1" }),
	} as any;
}

describe("createChatHandler", () => {
	it("returns 400 when message is missing", async () => {
		const store = createMockStore();
		const agentConfig = {} as any;
		const handler = createChatHandler(agentConfig, store);
		const req = mockReq({});
		const res = mockRes();
		await handler(req, res);
		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({ error: "message es requerido" });
	});

	it("returns 400 when message is not a string", async () => {
		const store = createMockStore();
		const handler = createChatHandler({} as any, store);
		const req = mockReq({ message: 123 });
		const res = mockRes();
		await handler(req, res);
		expect(res.status).toHaveBeenCalledWith(400);
	});

	it("sets SSE headers", async () => {
		const store = createMockStore();
		const handler = createChatHandler({} as any, store);
		const req = mockReq({ message: "hi" });
		const res = mockRes();
		await handler(req, res);
		expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
		expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
		expect(res.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
		expect(res.flushHeaders).toHaveBeenCalled();
	});

	it("creates session if it does not exist", async () => {
		const store = createMockStore(false);
		const handler = createChatHandler({} as any, store);
		const req = mockReq({ message: "hi", model: "qwen" });
		const res = mockRes();
		await handler(req, res);
		expect(store.createSession).toHaveBeenCalled();
	});

	it("does not create session if it already exists", async () => {
		const store = createMockStore(true);
		const handler = createChatHandler({} as any, store);
		const req = mockReq({ sessionId: "s1", message: "hi" });
		const res = mockRes();
		await handler(req, res);
		expect(store.createSession).not.toHaveBeenCalled();
	});

	it("writes SSE events and ends response", async () => {
		const mockRunAgent = vi.fn().mockResolvedValue({ content: "done" });
		vi.mock("../../agent/loop.js", () => ({
			runAgent: (...args: any[]) => mockRunAgent(...args),
		}));

		const store = createMockStore(true);
		const handler = createChatHandler({} as any, store);
		const req = mockReq({ sessionId: "s1", message: "hi" });
		const res = mockRes();
		await handler(req, res);
		expect(res.write).toHaveBeenCalled();
		expect(res.end).toHaveBeenCalled();
	});

	it("writes error event on agent failure", async () => {
		vi.mock("../../agent/loop.js", () => ({
			runAgent: vi.fn().mockRejectedValue(new Error("agent crashed")),
		}));

		const store = createMockStore(true);
		const handler = createChatHandler({} as any, store);
		const req = mockReq({ sessionId: "s1", message: "hi" });
		const res = mockRes();
		await handler(req, res);

		const errorCall = res.write.mock.calls.find((call: string[]) =>
			call[0].includes('"type":"error"'),
		);
		expect(errorCall).toBeDefined();
		expect(res.end).toHaveBeenCalled();
	});
});
