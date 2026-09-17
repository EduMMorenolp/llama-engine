import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionStore } from "../sessions/store.js";
import { buildPrompt, getMemoriesForContext } from "./prompt.js";

vi.mock("../sessions/store.js");

function createMockStore(messages: any[] = [], memories: any[] = []): SessionStore {
	return {
		getMessages: vi.fn().mockReturnValue(messages),
		searchMemories: vi.fn().mockReturnValue(memories),
	} as any;
}

describe("prompt", () => {
	describe("buildPrompt", () => {
		it("builds prompt with system message", () => {
			const store = createMockStore();
			const messages = buildPrompt({
				store,
				sessionId: "s1",
				systemPrompt: "You are a helpful assistant.",
			});
			expect(messages).toHaveLength(1);
			expect(messages[0].role).toBe("system");
			expect(messages[0].content).toContain("You are a helpful assistant.");
		});

		it("includes memories in system prompt", () => {
			const store = createMockStore();
			const messages = buildPrompt({
				store,
				sessionId: "s1",
				memories: [{ key: "name", content: "Eduardo" }],
			});
			expect(messages[0].content).toContain("Memoria del usuario");
			expect(messages[0].content).toContain("name: Eduardo");
		});

		it("includes message history", () => {
			const store = createMockStore([
				{ role: "user", content: "Hello", toolCalls: null, toolCallId: null },
				{ role: "assistant", content: "Hi!", toolCalls: null, toolCallId: null },
			]);
			const messages = buildPrompt({ store, sessionId: "s1" });
			expect(messages).toHaveLength(3);
			expect(messages[1].role).toBe("user");
			expect(messages[2].role).toBe("assistant");
		});

		it("handles tool messages in history", () => {
			const store = createMockStore([
				{ role: "user", content: "test", toolCalls: null, toolCallId: null },
				{
					role: "assistant",
					content: null,
					toolCalls: '[{"id":"tc1","type":"function","function":{"name":"bash","arguments":"{}"}}]',
					toolCallId: null,
				},
				{ role: "tool", content: "result", toolCalls: null, toolCallId: "tc1" },
			]);
			const messages = buildPrompt({ store, sessionId: "s1" });
			expect(messages).toHaveLength(4);
			expect(messages[2].role).toBe("assistant");
			expect(messages[2].tool_calls).toBeDefined();
			expect(messages[3].role).toBe("tool");
			expect(messages[3].tool_call_id).toBe("tc1");
		});
		it("uses default system prompt when none provided", () => {
			const store = createMockStore();
			const messages = buildPrompt({ store, sessionId: "s1" });
			expect(messages[0].content).toContain("asistente de IA");
		});

		it("includes memory management instructions", () => {
			const store = createMockStore();
			const messages = buildPrompt({
				store,
				sessionId: "s1",
				systemPrompt: "Custom prompt.",
			});
			const content = messages[0].content as string;
			expect(content).toContain("Gestión de Memoria");
			expect(content).toContain("search_memories");
			expect(content).toContain("memorize");
			expect(content).toContain("update_memory");
			expect(content).toContain("snake_case");
		});

		it("truncates history when exceeding maxHistoryChars", () => {
			const longMessage = { role: "user", content: "x".repeat(20000), toolCalls: null, toolCallId: null };
			const store = createMockStore([
				longMessage,
				longMessage,
				longMessage,
				longMessage,
				longMessage,
			]);
			const messages = buildPrompt({ store, sessionId: "s1", maxHistoryChars: 30000 });
			expect(messages[0].role).toBe("system");
			// Should keep first + some recent, skip middle
			const userMsgs = messages.filter((m) => m.role === "user");
			expect(userMsgs.length).toBeLessThanOrEqual(3);
		});

		it("does not truncate when under maxHistoryChars", () => {
			const store = createMockStore([
				{ role: "user", content: "short", toolCalls: null, toolCallId: null },
				{ role: "assistant", content: "ok", toolCalls: null, toolCallId: null },
			]);
			const messages = buildPrompt({ store, sessionId: "s1", maxHistoryChars: 60000 });
			expect(messages).toHaveLength(3);
		});

		it("handles invalid toolCalls JSON gracefully", () => {
			const store = createMockStore([
				{ role: "user", content: "test", toolCalls: null, toolCallId: null },
				{
					role: "assistant",
					content: "some text",
					toolCalls: "invalid json {{{",
					toolCallId: null,
				},
			]);
			const messages = buildPrompt({ store, sessionId: "s1" });
			expect(messages).toHaveLength(3);
			expect(messages[2].role).toBe("assistant");
			// Falls back to content only, no tool_calls
			expect(messages[2].tool_calls).toBeUndefined();
		});

		it("truncates long tool result content", () => {
			const store = createMockStore([
				{ role: "user", content: "test", toolCalls: null, toolCallId: null },
				{
					role: "assistant",
					content: null,
					toolCalls: '[{"id":"tc1","type":"function","function":{"name":"bash","arguments":"{}"}}]',
					toolCallId: null,
				},
				{ role: "tool", content: "x".repeat(20000), toolCalls: null, toolCallId: "tc1" },
			]);
			const messages = buildPrompt({ store, sessionId: "s1" });
			const toolMsg = messages.find((m) => m.role === "tool");
			expect(toolMsg).toBeDefined();
			expect((toolMsg!.content as string).length).toBeLessThan(20000);
			expect(toolMsg!.content).toContain("truncado");
		});

		it("detects vision models for image messages", () => {
			const base64Img = "data:image/png;base64,iVBORw0KGgo=";
			const store = createMockStore([
				{
					role: "user",
					content: `![test](${base64Img})`,
					toolCalls: null,
					toolCallId: null,
				},
			]);
			const messages = buildPrompt({
				store,
				sessionId: "s1",
				model: "qwen3.5-4b",
			});
			const userMsg = messages.find((m) => m.role === "user");
			expect(userMsg).toBeDefined();
			expect(Array.isArray(userMsg!.content)).toBe(true);
		});

		it("formats image messages as multimodal image_url parts", () => {
			const base64Img = "data:image/png;base64,iVBORw0KGgo=";
			const store = createMockStore([
				{
					role: "user",
					content: `![test](${base64Img})`,
					toolCalls: null,
					toolCallId: null,
				},
			]);
			const messages = buildPrompt({
				store,
				sessionId: "s1",
				model: "qwen3.5-4b",
			});
			const userMsg = messages.find((m) => m.role === "user");
			expect(userMsg).toBeDefined();
			expect(Array.isArray(userMsg!.content)).toBe(true);
			const parts = userMsg!.content as any[];
			expect(parts.some((p) => p.type === "image_url")).toBe(true);
		});
	});

	describe("getMemoriesForContext", () => {
		it("returns memories as key-content pairs", () => {
			const store = createMockStore(
				[],
				[
					{ key: "name", content: "Eduardo" },
					{ key: "lang", content: "Español" },
				],
			);
			const memories = getMemoriesForContext(store);
			expect(memories).toHaveLength(2);
			expect(memories[0]).toEqual({ key: "name", content: "Eduardo" });
		});

		it("returns empty array when no memories", () => {
			const store = createMockStore([], []);
			const memories = getMemoriesForContext(store);
			expect(memories).toEqual([]);
		});
	});
});
