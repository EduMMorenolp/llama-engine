import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionStore } from "../sessions/store.js";
import { ToolRegistry } from "../tools/registry.js";
import type { ToolSpec } from "../tools/types.js";
import type { LLMClient } from "./llm-client.js";
import { type AgentLoopConfig, runAgent } from "./loop.js";

vi.mock("./llm-client.js");

function createMockLLM(toolCalls: any[] = [], content: string = "Final answer") {
	return {
		sendMessage: vi.fn().mockResolvedValue({
			content: toolCalls.length === 0 ? content : null,
			tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
			finish_reason: "stop",
		}),
		getModel: vi.fn().mockReturnValue("test-model"),
	} as unknown as LLMClient;
}

function createMockStore() {
	const messages: any[] = [];
	return {
		addMessage: vi
			.fn()
			.mockImplementation((id, sessionId, role, content, toolCalls, toolCallId) => {
				messages.push({ id, sessionId, role, content, toolCalls, toolCallId });
				return { id, role, content };
			}),
		getMessages: vi.fn().mockReturnValue([]),
		searchMemories: vi.fn().mockReturnValue([]),
	} as unknown as SessionStore;
}

function createTestTool(name: string): ToolSpec {
	return {
		type: "function",
		function: {
			name,
			description: `Test tool ${name}`,
			parameters: {
				type: "object",
				properties: { input: { type: "string" } },
				required: ["input"],
			},
		},
	};
}

describe("agent loop", () => {
	it("returns content when no tool calls", async () => {
		const llm = createMockLLM([], "Hello world");
		const store = createMockStore();
		const registry = new ToolRegistry();

		const config: AgentLoopConfig = {
			llmClient: llm,
			toolRegistry: registry,
			store,
			maxIterations: 10,
			workDir: "/tmp",
		};

		const result = await runAgent(config, {
			sessionId: "s1",
			message: "Hi",
		});

		expect(result.content).toBe("Hello world");
		expect(result.iterations).toBe(1);
		expect(result.toolCalls).toHaveLength(0);
	});

	it("executes tool calls and loops", async () => {
		const llm = createMockLLM(
			[
				{
					id: "tc1",
					type: "function",
					function: { name: "bash", arguments: '{"command":"echo test"}' },
				},
			],
			"",
		);
		llm.sendMessage = vi
			.fn()
			.mockResolvedValueOnce({
				content: null,
				tool_calls: [
					{
						id: "tc1",
						type: "function",
						function: { name: "bash", arguments: '{"command":"echo test"}' },
					},
				],
				finish_reason: "tool_calls",
			})
			.mockResolvedValueOnce({
				content: "Done!",
				tool_calls: undefined,
				finish_reason: "stop",
			});

		const store = createMockStore();
		const registry = new ToolRegistry();
		registry.register(createTestTool("bash"), async () => "test output");

		const config: AgentLoopConfig = {
			llmClient: llm,
			toolRegistry: registry,
			store,
			maxIterations: 10,
			workDir: "/tmp",
		};

		const events: any[] = [];
		const result = await runAgent(config, { sessionId: "s1", message: "run echo" }, (e) =>
			events.push(e),
		);

		expect(result.content).toBe("Done!");
		expect(result.iterations).toBe(2);
		expect(result.toolCalls).toHaveLength(1);
		expect(result.toolCalls[0].name).toBe("bash");
		expect(result.toolCalls[0].result).toBe("test output");
		expect(events.some((e) => e.type === "tool_start")).toBe(true);
		expect(events.some((e) => e.type === "tool_end")).toBe(true);
		expect(events.some((e) => e.type === "done")).toBe(true);
	});

	it("stops after max iterations", async () => {
		const llm = createMockLLM();
		llm.sendMessage = vi.fn().mockResolvedValue({
			content: null,
			tool_calls: [
				{
					id: "tc1",
					type: "function",
					function: { name: "bash", arguments: '{"command":"loop"}' },
				},
			],
			finish_reason: "tool_calls",
		});

		const store = createMockStore();
		const registry = new ToolRegistry();
		registry.register(createTestTool("bash"), async () => "output");

		const config: AgentLoopConfig = {
			llmClient: llm,
			toolRegistry: registry,
			store,
			maxIterations: 2,
			workDir: "/tmp",
		};

		const result = await runAgent(config, { sessionId: "s1", message: "loop" });
		expect(result.iterations).toBe(2);
		expect(llm.sendMessage).toHaveBeenCalledTimes(2);
	});

	it("handles tool execution errors gracefully", async () => {
		const llm = createMockLLM();
		llm.sendMessage = vi
			.fn()
			.mockResolvedValueOnce({
				content: null,
				tool_calls: [
					{
						id: "tc1",
						type: "function",
						function: { name: "failing_tool", arguments: "{}" },
					},
				],
				finish_reason: "tool_calls",
			})
			.mockResolvedValueOnce({
				content: "Recovered",
				tool_calls: undefined,
				finish_reason: "stop",
			});

		const store = createMockStore();
		const registry = new ToolRegistry();
		registry.register(createTestTool("failing_tool"), async () => {
			throw new Error("Tool failed!");
		});

		const config: AgentLoopConfig = {
			llmClient: llm,
			toolRegistry: registry,
			store,
			maxIterations: 10,
			workDir: "/tmp",
		};

		const result = await runAgent(config, { sessionId: "s1", message: "fail" });
		expect(result.content).toBe("Recovered");
		expect(result.toolCalls[0].result).toContain("Error");
	});
});
