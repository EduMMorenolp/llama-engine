import { describe, expect, it } from "vitest";
import { globSearchTool, grepSearchTool } from "./search.js";

describe("search tools", () => {
	describe("glob_search", () => {
		it("has correct spec", () => {
			expect(globSearchTool.function.name).toBe("glob_search");
			expect(globSearchTool.function.parameters.required).toContain("pattern");
		});
	});

	describe("grep_search", () => {
		it("has correct spec", () => {
			expect(grepSearchTool.function.name).toBe("grep_search");
			expect(grepSearchTool.function.parameters.required).toContain("pattern");
		});
	});
});
