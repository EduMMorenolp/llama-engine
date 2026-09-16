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
	});
});
