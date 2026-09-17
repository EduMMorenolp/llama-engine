import type { Database } from "sql.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb } from "../../sessions/db.js";
import { MemoryService } from "./service.js";

let db: Database;
let service: MemoryService;

beforeAll(async () => {
	db = await getDb(":memory:");
	service = new MemoryService(db);
});

afterAll(() => {
	closeDb();
});

describe("MemoryService", () => {
	describe("upsert", () => {
		it("inserts a new memory", () => {
			const memory = service.upsert("user_name", "Eduardo", ["lang"]);
			expect(memory.key).toBe("user_name");
			expect(memory.content).toBe("Eduardo");
			expect(memory.tags).toEqual(["lang"]);
			expect(memory.id).toMatch(/^mem_/);
			expect(memory.createdAt).toBeGreaterThan(0);
		});

		it("updates existing memory on second upsert", () => {
			const first = service.upsert("pref_color", "azul", []);
			const second = service.upsert("pref_color", "rojo", ["changed"]);
			expect(second.key).toBe("pref_color");
			expect(second.content).toBe("rojo");
			expect(second.tags).toEqual(["changed"]);
			expect(second.id).toBe(first.id);
			expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
		});
	});

	describe("get", () => {
		it("returns memory by key", () => {
			service.upsert("test_get", "value1", []);
			const memory = service.get("test_get");
			expect(memory).not.toBeNull();
			expect(memory!.key).toBe("test_get");
			expect(memory!.content).toBe("value1");
		});

		it("returns null for non-existent key", () => {
			const memory = service.get("nonexistent_key_xyz");
			expect(memory).toBeNull();
		});
	});

	describe("search", () => {
		it("finds memories by key match", () => {
			service.upsert("search_key_alpha", "alpha_value", []);
			const results = service.search("search_key_alpha");
			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results.some((m) => m.key === "search_key_alpha")).toBe(true);
		});

		it("finds memories by content match", () => {
			service.upsert("search_content_test", "unique_content_xyz", []);
			const results = service.search("unique_content_xyz");
			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results.some((m) => m.key === "search_content_test")).toBe(true);
		});

		it("returns empty for no matches", () => {
			const results = service.search("zzz_nonexistent_zzz");
			expect(results).toEqual([]);
		});

		it("returns all memories with empty query", () => {
			service.upsert("empty_q_1", "val1", []);
			service.upsert("empty_q_2", "val2", []);
			const results = service.search("");
			expect(results.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("delete", () => {
		it("deletes existing memory and returns true", () => {
			service.upsert("to_delete", "bye", []);
			const deleted = service.delete("to_delete");
			expect(deleted).toBe(true);
			expect(service.get("to_delete")).toBeNull();
		});

		it("returns false for non-existent key", () => {
			const deleted = service.delete("nonexistent_del_xyz");
			expect(deleted).toBe(false);
		});
	});
});
