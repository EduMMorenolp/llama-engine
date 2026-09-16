import { beforeEach, describe, expect, it, vi } from "vitest";
import { LLMClient } from "./llm-client.js";

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
});
