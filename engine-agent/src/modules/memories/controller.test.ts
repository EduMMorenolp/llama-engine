import type { Database } from "sql.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb } from "../../sessions/db.js";
import { MemoryController } from "./controller.js";
import { MemoryService } from "./service.js";

let db: Database;
let service: MemoryService;
let controller: MemoryController;

beforeAll(async () => {
	db = await getDb(":memory:");
	service = new MemoryService(db);
	controller = new MemoryController(service);
});

afterAll(() => {
	closeDb();
});

function mockReq(body?: any, query?: Record<string, string>, params?: Record<string, string>) {
	return { body, query: query ?? {}, params: params ?? {} } as any;
}

function mockRes() {
	const res: any = {};
	res.status = vi.fn().mockReturnValue(res);
	res.json = vi.fn().mockReturnValue(res);
	return res;
}

describe("MemoryController", () => {
	describe("list", () => {
		it("returns memories as JSON", () => {
			service.upsert("ctrl_list_1", "val1", []);
			service.upsert("ctrl_list_2", "val2", []);
			const req = mockReq(undefined, { q: "ctrl_list" });
			const res = mockRes();
			controller.list(req, res, vi.fn());
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({
					memories: expect.arrayContaining([
						expect.objectContaining({ key: "ctrl_list_1" }),
					]),
				}),
			);
		});

		it("filters by query parameter", () => {
			service.upsert("ctrl_filter_abc", "unique_abc", []);
			const req = mockReq(undefined, { q: "ctrl_filter_abc" });
			const res = mockRes();
			controller.list(req, res, vi.fn());
			const call = res.json.mock.calls[0][0];
			expect(call.memories.some((m: any) => m.key === "ctrl_filter_abc")).toBe(true);
		});

		it("returns empty array when no matches", () => {
			const req = mockReq(undefined, { q: "zzz_no_match_zzz" });
			const res = mockRes();
			controller.list(req, res, vi.fn());
			expect(res.json).toHaveBeenCalledWith({ memories: [] });
		});
	});

	describe("create", () => {
		it("creates a new memory and returns 201", () => {
			const req = mockReq({ key: "ctrl_create_new", content: "new_val", tags: ["a"] });
			const res = mockRes();
			controller.create(req, res, vi.fn());
			expect(res.status).toHaveBeenCalledWith(201);
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ key: "ctrl_create_new", content: "new_val" }),
			);
		});

		it("defaults tags to empty array when not provided", () => {
			const req = mockReq({ key: "ctrl_no_tags", content: "val" });
			const res = mockRes();
			controller.create(req, res, vi.fn());
			expect(res.status).toHaveBeenCalledWith(201);
			const call = res.json.mock.calls[0][0];
			expect(call.tags).toEqual([]);
		});

		it("updates existing memory via upsert", () => {
			service.upsert("ctrl_upsert", "old", []);
			const req = mockReq({ key: "ctrl_upsert", content: "new", tags: [] });
			const res = mockRes();
			controller.create(req, res, vi.fn());
			expect(res.json).toHaveBeenCalledWith(
				expect.objectContaining({ key: "ctrl_upsert", content: "new" }),
			);
		});
	});

	describe("delete", () => {
		it("deletes existing memory and returns ok", () => {
			service.upsert("ctrl_del", "bye", []);
			const req = mockReq(undefined, undefined, { key: "ctrl_del" });
			const res = mockRes();
			controller.delete(req, res, vi.fn());
			expect(res.json).toHaveBeenCalledWith({ ok: true });
		});

		it("returns 404 for non-existent key", () => {
			const req = mockReq(undefined, undefined, { key: "ctrl_del_nonexist" });
			const res = mockRes();
			controller.delete(req, res, vi.fn());
			expect(res.status).toHaveBeenCalledWith(404);
			expect(res.json).toHaveBeenCalledWith({ error: "Memoria no encontrada" });
		});
	});
});
