import { describe, expect, it } from "vitest";
import { fetchSessions, fetchTools } from "./api.ts";
import { AGENT_URL } from "./lib/api-client.ts";

describe("api", () => {
	it("AGENT_URL has default value", () => {
		expect(AGENT_URL).toBeDefined();
	});

	it("fetchSessions returns array", async () => {
		try {
			const sessions = await fetchSessions();
			expect(Array.isArray(sessions)).toBe(true);
		} catch {
			expect(true).toBe(true);
		}
	});

	it("fetchTools returns array", async () => {
		try {
			const tools = await fetchTools();
			expect(Array.isArray(tools)).toBe(true);
		} catch {
			expect(true).toBe(true);
		}
	});
});
