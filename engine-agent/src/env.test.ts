import { beforeEach, describe, expect, it } from "vitest";
import { getConfig, resetConfig } from "./config/index.js";

describe("config", () => {
	beforeEach(() => {
		resetConfig();
	});

	it("fails if ENGINE_API_KEY is missing", () => {
		const original = process.env.ENGINE_API_KEY;
		delete process.env.ENGINE_API_KEY;
		expect(() => getConfig()).toThrow("ENGINE_API_KEY es requerida");
		if (original) process.env.ENGINE_API_KEY = original;
	});

	it("returns config with defaults", () => {
		process.env.ENGINE_API_KEY = "test-key";
		const config = getConfig();
		expect(config.AGENT_PORT).toBe(3060);
		expect(config.ENGINE_API_URL).toBe("http://localhost:3050");
		expect(config.ENGINE_API_KEY).toBe("test-key");
		expect(config.MAX_ITERATIONS).toBe(10);
	});

	it("respects custom values", () => {
		process.env.ENGINE_API_KEY = "my-key";
		process.env.AGENT_PORT = "4000";
		process.env.ENGINE_API_URL = "http://remote:8080";
		const config = getConfig();
		expect(config.AGENT_PORT).toBe(4000);
		expect(config.ENGINE_API_URL).toBe("http://remote:8080");
		expect(config.ENGINE_API_KEY).toBe("my-key");
	});

	it("caches config after first call", () => {
		process.env.ENGINE_API_KEY = "test-key";
		const config1 = getConfig();
		const config2 = getConfig();
		expect(config1).toBe(config2);
	});
});
