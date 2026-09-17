import type { Database } from "sql.js";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb } from "./db/index.js";
import { createApp, type ServerConfig } from "./server.js";
import { SessionStore } from "./sessions/store.js";
import { ToolRegistry } from "./tools/registry.js";

let db: Database;
let store: SessionStore;
let registry: ToolRegistry;
let app: ReturnType<typeof createApp>;

const config: ServerConfig = {
	port: 3060,
	apiKey: "test-key",
};

beforeAll(async () => {
	process.env.ENGINE_API_KEY = "test-key";
	process.env.DB_PATH = ":memory:";

	db = await getDb();
	store = new SessionStore(db);
	registry = new ToolRegistry();
	app = createApp(config, db, store, registry, {
		llmClient: {} as any,
		toolRegistry: registry,
		store,
		maxIterations: 10,
		workDir: "/tmp",
	});
});

afterAll(() => {
	closeDb();
});

describe("server", () => {
	describe("GET /api/health", () => {
		it("returns status ok", async () => {
			const res = await request(app).get("/api/health");
			expect(res.status).toBe(200);
			expect(res.body.status).toBe("ok");
		});
	});

	describe("POST /api/chat", () => {
		it("requires auth", async () => {
			const res = await request(app).post("/api/chat").send({ message: "hi" });
			expect(res.status).toBe(401);
		});

		it("returns 400 without message", async () => {
			const res = await request(app).post("/api/chat").set("x-api-key", "test-key").send({});
			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/sessions", () => {
		it("requires auth", async () => {
			const res = await request(app).get("/api/sessions");
			expect(res.status).toBe(401);
		});

		it("returns session list", async () => {
			const res = await request(app).get("/api/sessions").set("x-api-key", "test-key");
			expect(res.status).toBe(200);
			expect(res.body.sessions).toBeDefined();
		});
	});

	describe("POST /api/sessions", () => {
		it("creates session", async () => {
			const res = await request(app)
				.post("/api/sessions")
				.set("x-api-key", "test-key")
				.send({ name: "Test" });
			expect(res.status).toBe(201);
			expect(res.body.id).toBeDefined();
			expect(res.body.name).toBe("Test");
		});
	});

	describe("GET /api/sessions/:id", () => {
		it("returns 404 for non-existent session", async () => {
			const res = await request(app).get("/api/sessions/nonexistent").set("x-api-key", "test-key");
			expect(res.status).toBe(404);
		});
	});

	describe("DELETE /api/sessions/:id", () => {
		it("deletes session", async () => {
			const create = await request(app)
				.post("/api/sessions")
				.set("x-api-key", "test-key")
				.send({ name: "To Delete" });
			const res = await request(app)
				.delete(`/api/sessions/${create.body.id}`)
				.set("x-api-key", "test-key");
			expect(res.status).toBe(200);
			expect(res.body.ok).toBe(true);
		});
	});

	describe("PATCH /api/sessions/:id", () => {
		it("renames a session", async () => {
			const create = await request(app)
				.post("/api/sessions")
				.set("x-api-key", "test-key")
				.send({ name: "Original Title" });
			const res = await request(app)
				.patch(`/api/sessions/${create.body.id}`)
				.set("x-api-key", "test-key")
				.send({ name: "Renamed Title" });
			expect(res.status).toBe(200);
			expect(res.body.name).toBe("Renamed Title");
		});
	});

	describe("GET /api/tools", () => {
		it("returns tool list", async () => {
			const res = await request(app).get("/api/tools").set("x-api-key", "test-key");
			expect(res.status).toBe(200);
			expect(res.body.tools).toBeDefined();
		});
	});

	describe("GET /api/memories", () => {
		it("returns memory list", async () => {
			const res = await request(app).get("/api/memories").set("x-api-key", "test-key");
			expect(res.status).toBe(200);
			expect(res.body.memories).toBeDefined();
		});
	});
});
