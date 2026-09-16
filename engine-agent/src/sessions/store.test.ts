import type { Database } from "sql.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb } from "./db.js";
import { SessionStore } from "./store.js";

let db: Database;
let store: SessionStore;

beforeAll(async () => {
	db = await getDb(":memory:");
	store = new SessionStore(db);
});

afterAll(() => {
	closeDb();
});

describe("SessionStore", () => {
	describe("sessions", () => {
		it("createSession returns new session", () => {
			const session = store.createSession("s1", "Test Session", "qwen3.5-4b");
			expect(session.id).toBe("s1");
			expect(session.name).toBe("Test Session");
			expect(session.model).toBe("qwen3.5-4b");
			expect(session.createdAt).toBeGreaterThan(0);
		});

		it("getSession returns session with messages", () => {
			store.addMessage("m1", "s1", "user", "Hello");
			store.addMessage("m2", "s1", "assistant", "Hi there");
			const session = store.getSession("s1");
			expect(session).not.toBeNull();
			expect(session!.id).toBe("s1");
		});

		it("listSessions returns all sessions", () => {
			store.createSession("s2", "Another Session");
			const sessions = store.listSessions();
			expect(sessions.length).toBeGreaterThanOrEqual(2);
		});

		it("deleteSession removes session and messages", () => {
			store.createSession("s3", "To Delete");
			store.addMessage("m3", "s3", "user", "test");
			const deleted = store.deleteSession("s3");
			expect(deleted).toBe(true);
			expect(store.getSession("s3")).toBeNull();
			expect(store.getMessages("s3")).toHaveLength(0);
		});

		it("updateSession updates fields", () => {
			store.createSession("s4", "Original");
			store.updateSession("s4", { name: "Updated" });
			expect(store.getSession("s4")!.name).toBe("Updated");
		});
	});

	describe("messages", () => {
		it("addMessage persists message to session", () => {
			store.createSession("s5", "Msg Test");
			const msg = store.addMessage("m5", "s5", "user", "Hello world");
			expect(msg).toBeDefined();
			expect(msg.role).toBe("user");
			expect(msg.content).toBe("Hello world");
		});

		it("getMessages returns messages ordered by createdAt", () => {
			store.addMessage("m6a", "s5", "assistant", "Response 1");
			store.addMessage("m6b", "s5", "user", "Follow up");
			store.addMessage("m6c", "s5", "assistant", "Response 2");
			const messages = store.getMessages("s5");
			expect(messages.length).toBeGreaterThanOrEqual(3);
			expect(messages[0].content).toBe("Hello world");
		});
	});

	describe("memories", () => {
		it("upsertMemory stores key-value", () => {
			const mem = store.upsertMemory("user_name", "Eduardo", ["user"]);
			expect(mem.key).toBe("user_name");
			expect(mem.content).toBe("Eduardo");
			expect(mem.tags).toEqual(["user"]);
		});

		it("searchMemories finds by keyword", () => {
			store.upsertMemory("user_lang", "Español", ["user", "lang"]);
			const results = store.searchMemories("Eduardo");
			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results.some((m) => m.key === "user_name")).toBe(true);
		});

		it("getMemory returns null for non-existent key", () => {
			expect(store.getMemory("nonexistent")).toBeNull();
		});

		it("deleteMemory removes memory", () => {
			store.upsertMemory("temp", "temp value", []);
			const deleted = store.deleteMemory("temp");
			expect(deleted).toBe(true);
			expect(store.getMemory("temp")).toBeNull();
		});

		it("upsertMemory updates existing key", () => {
			store.upsertMemory("update_test", "original", ["a"]);
			store.upsertMemory("update_test", "updated", ["b"]);
			const mem = store.getMemory("update_test");
			expect(mem!.content).toBe("updated");
			expect(mem!.tags).toEqual(["b"]);
		});
	});
});
