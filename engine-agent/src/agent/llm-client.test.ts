import { beforeEach, describe, expect, it, vi } from "vitest";
import { LLMClient } from "./llm-client.js";

vi.mock("openai", () => {
	return {
		default: class MockOpenAI {
			constructor() {}
			chat = {
				completions: {
					create: vi.fn(),
				},
			};
		},
	};
});

function createClient() {
	return new LLMClient({
		apiUrl: "http://localhost:3050",
		apiKey: "test-key",
		model: "test-model",
	});
}

describe("LLMClient", () => {
	it("normalizes baseURL by appending /v1 if missing", () => {
		const client = new LLMClient({
			apiUrl: "http://localhost:3050",
			apiKey: "test-key",
			model: "default",
		});
		expect(client.getBaseURL()).toBe("http://localhost:3050/v1");
	});

	it("preserves baseURL if /v1 is already present", () => {
		const client = new LLMClient({
			apiUrl: "http://localhost:3050/v1",
			apiKey: "test-key",
			model: "default",
		});
		expect(client.getBaseURL()).toBe("http://localhost:3050/v1");
	});

	it("returns configured model", () => {
		const client = new LLMClient({
			apiUrl: "http://localhost:3050",
			apiKey: "test-key",
			model: "qwen3.5",
		});
		expect(client.getModel()).toBe("qwen3.5");
	});

	it("handles trailing slashes properly", () => {
		const client = new LLMClient({
			apiUrl: "http://localhost:3050///",
			apiKey: "test-key",
			model: "default",
		});
		expect(client.getBaseURL()).toBe("http://localhost:3050/v1");
	});

	describe("sendMessage", () => {
		it("returns content on success", async () => {
			const client = createClient();
			const mockCreate = vi.fn().mockResolvedValue({
				choices: [
					{
						message: { content: "Hello!", tool_calls: null },
						finish_reason: "stop",
					},
				],
			});
			(client as any).client.chat.completions.create = mockCreate;

			const result = await client.sendMessage(
				[{ role: "user", content: "Hi" }],
				[],
			);
			expect(result.content).toBe("Hello!");
			expect(result.tool_calls).toBeNull();
			expect(result.finish_reason).toBe("stop");
		});

		it("returns tool_calls when present", async () => {
			const client = createClient();
			const mockCreate = vi.fn().mockResolvedValue({
				choices: [
					{
						message: {
							content: null,
							tool_calls: [
								{
									id: "tc1",
									type: "function",
									function: { name: "bash", arguments: "{}" },
								},
							],
						},
						finish_reason: "tool_calls",
					},
				],
			});
			(client as any).client.chat.completions.create = mockCreate;

			const result = await client.sendMessage(
				[{ role: "user", content: "run" }],
				[{ type: "function", function: { name: "bash", description: "bash", parameters: { type: "object", properties: {} } } }],
			);
			expect(result.tool_calls).toHaveLength(1);
			expect(result.tool_calls![0].function.name).toBe("bash");
		});

		it("throws on empty response", async () => {
			const client = createClient();
			const mockCreate = vi.fn().mockResolvedValue({ choices: [] });
			(client as any).client.chat.completions.create = mockCreate;

			await expect(
				client.sendMessage([{ role: "user", content: "Hi" }], []),
			).rejects.toThrow("respuesta vacía");
		});

		it("rewrites image error to friendly message", async () => {
			const client = createClient();
			const mockCreate = vi.fn().mockRejectedValue({
				status: 400,
				error: { message: "image input is not supported by this model" },
			});
			(client as any).client.chat.completions.create = mockCreate;

			await expect(
				client.sendMessage([{ role: "user", content: "Hi" }], []),
			).rejects.toThrow("mmproj no cargado");
		});

		it("includes error message in exception", async () => {
			const client = createClient();
			const mockCreate = vi.fn().mockRejectedValue({
				status: 500,
				error: { message: "Internal error" },
			});
			(client as any).client.chat.completions.create = mockCreate;

			await expect(
				client.sendMessage([{ role: "user", content: "Hi" }], []),
			).rejects.toThrow("Internal error");
		});

		it("uses provided model over default", async () => {
			const client = createClient();
			const mockCreate = vi.fn().mockResolvedValue({
				choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
			});
			(client as any).client.chat.completions.create = mockCreate;

			await client.sendMessage([{ role: "user", content: "Hi" }], [], "custom-model");
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({ model: "custom-model" }),
			);
		});
	});

	describe("sendMessageStream", () => {
		it("yields content chunks", async () => {
			const client = createClient();
			const mockStream = [
				{ choices: [{ delta: { content: "Hello" }, finish_reason: null }] },
				{ choices: [{ delta: { content: " world" }, finish_reason: null }] },
				{ choices: [{ delta: {}, finish_reason: "stop" }] },
			];
			const mockCreate = vi.fn().mockResolvedValue(mockStream);
			(client as any).client.chat.completions.create = mockCreate;

			const chunks: any[] = [];
			for await (const chunk of client.sendMessageStream(
				[{ role: "user", content: "Hi" }],
				[],
			)) {
				chunks.push(chunk);
			}

			expect(chunks).toHaveLength(3);
			expect(chunks[0]).toEqual({ type: "content", data: "Hello" });
			expect(chunks[1]).toEqual({ type: "content", data: " world" });
			expect(chunks[2]).toEqual({ type: "finish", data: "stop" });
		});

		it("yields tool_call chunks", async () => {
			const client = createClient();
			const mockStream = [
				{
					choices: [
						{
							delta: {
								tool_calls: [{ id: "tc1", function: { name: "bash", arguments: "{}" } }],
							},
							finish_reason: null,
						},
					],
				},
				{ choices: [{ delta: {}, finish_reason: "stop" }] },
			];
			const mockCreate = vi.fn().mockResolvedValue(mockStream);
			(client as any).client.chat.completions.create = mockCreate;

			const chunks: any[] = [];
			for await (const chunk of client.sendMessageStream(
				[{ role: "user", content: "run" }],
				[{ type: "function", function: { name: "bash", description: "bash", parameters: { type: "object", properties: {} } } }],
			)) {
				chunks.push(chunk);
			}

			expect(chunks.some((c) => c.type === "tool_call")).toBe(true);
		});

		it("throws on stream error", async () => {
			const client = createClient();
			const mockCreate = vi.fn().mockRejectedValue({
				status: 500,
				error: { message: "Stream failed" },
			});
			(client as any).client.chat.completions.create = mockCreate;

			const gen = client.sendMessageStream([{ role: "user", content: "Hi" }], []);
			await expect(gen.next()).rejects.toThrow("Stream failed");
		});
	});
});
