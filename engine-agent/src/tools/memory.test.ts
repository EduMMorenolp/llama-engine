import { describe, expect, it } from "vitest";
import { memorizeTool, searchMemoriesTool, updateMemoryTool } from "./memory.js";

describe("memory tools", () => {
	describe("memorize", () => {
		it("has correct spec", () => {
			expect(memorizeTool.function.name).toBe("memorize");
			expect(memorizeTool.function.parameters.required).toContain("key");
			expect(memorizeTool.function.parameters.required).toContain("content");
		});
	});

	describe("search_memories", () => {
		it("has correct spec", () => {
			expect(searchMemoriesTool.function.name).toBe("search_memories");
			expect(searchMemoriesTool.function.parameters.required).toContain("query");
		});
	});

	describe("update_memory", () => {
		it("has correct spec", () => {
			expect(updateMemoryTool.function.name).toBe("update_memory");
			expect(updateMemoryTool.function.parameters.required).toContain("key");
			expect(updateMemoryTool.function.parameters.required).toContain("content");
		});
	});
});
