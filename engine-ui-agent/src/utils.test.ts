import { describe, expect, it } from "vitest";
import { randomUUID } from "./utils.ts";

describe("utils", () => {
	it("randomUUID returns a string", () => {
		const id = randomUUID();
		expect(typeof id).toBe("string");
		expect(id.length).toBeGreaterThan(0);
	});

	it("randomUUID returns unique values", () => {
		const ids = new Set(Array.from({ length: 100 }, () => randomUUID()));
		expect(ids.size).toBe(100);
	});
});
