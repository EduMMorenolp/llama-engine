import type { Database } from "sql.js";
import type { Memory, Message, Session } from "./types.js";

export class SessionStore {
	constructor(private db: Database) {}

	createSession(id: string, name?: string, model?: string): Session {
		this.db.run("INSERT INTO sessions (id, name, model) VALUES (?, ?, ?)", [
			id,
			name ?? null,
			model ?? null,
		]);
		return this.getSession(id)!;
	}

	getSession(id: string): Session | null {
		const stmt = this.db.prepare("SELECT * FROM sessions WHERE id = ?");
		stmt.bind([id]);
		if (!stmt.step()) {
			stmt.free();
			return null;
		}
		const row = stmt.getAsObject();
		stmt.free();
		return {
			id: row.id as string,
			name: row.name as string | null,
			model: row.model as string | null,
			createdAt: (row.created_at as number) * 1000,
			updatedAt: (row.updated_at as number) * 1000,
		};
	}

	listSessions(): Session[] {
		const stmt = this.db.prepare("SELECT * FROM sessions ORDER BY updated_at DESC");
		const sessions: Session[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject();
			sessions.push({
				id: row.id as string,
				name: row.name as string | null,
				model: row.model as string | null,
				createdAt: (row.created_at as number) * 1000,
				updatedAt: (row.updated_at as number) * 1000,
			});
		}
		stmt.free();
		return sessions;
	}

	deleteSession(id: string): boolean {
		this.db.run("DELETE FROM messages WHERE session_id = ?", [id]);
		this.db.run("DELETE FROM sessions WHERE id = ?", [id]);
		return this.db.getRowsModified() > 0;
	}

	updateSession(id: string, data: { name?: string; model?: string }): void {
		const fields: string[] = [];
		const values: unknown[] = [];
		if (data.name !== undefined) {
			fields.push("name = ?");
			values.push(data.name);
		}
		if (data.model !== undefined) {
			fields.push("model = ?");
			values.push(data.model);
		}
		if (fields.length === 0) return;
		fields.push("updated_at = unixepoch()");
		values.push(id);
		this.db.run(`UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`, values as any[]);
	}

	addMessage(
		id: string,
		sessionId: string,
		role: string,
		content: string | null,
		toolCalls?: string | null,
		toolCallId?: string | null,
	): Message {
		this.db.run(
			"INSERT INTO messages (id, session_id, role, content, tool_calls, tool_call_id) VALUES (?, ?, ?, ?, ?, ?)",
			[id, sessionId, role, content, toolCalls ?? null, toolCallId ?? null],
		);
		this.db.run("UPDATE sessions SET updated_at = unixepoch() WHERE id = ?", [sessionId]);
		const stmt = this.db.prepare("SELECT * FROM messages WHERE id = ?");
		stmt.bind([id]);
		stmt.step();
		const row = stmt.getAsObject();
		stmt.free();
		return {
			id: row.id as string,
			sessionId: row.session_id as string,
			role: row.role as "system" | "user" | "assistant" | "tool",
			content: row.content as string | null,
			toolCalls: row.tool_calls as string | null,
			toolCallId: row.tool_call_id as string | null,
			createdAt: (row.created_at as number) * 1000,
		};
	}

	getMessages(sessionId: string): Message[] {
		const stmt = this.db.prepare(
			"SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC",
		);
		stmt.bind([sessionId]);
		const messages: Message[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject();
			messages.push({
				id: row.id as string,
				sessionId: row.session_id as string,
				role: row.role as "system" | "user" | "assistant" | "tool",
				content: row.content as string | null,
				toolCalls: row.tool_calls as string | null,
				toolCallId: row.tool_call_id as string | null,
				createdAt: (row.created_at as number) * 1000,
			});
		}
		stmt.free();
		return messages;
	}

	upsertMemory(key: string, content: string, tags: string[]): Memory {
		const existing = this.getMemory(key);
		if (existing) {
			this.db.run(
				"UPDATE memories SET content = ?, tags = ?, updated_at = unixepoch() WHERE key = ?",
				[content, JSON.stringify(tags), key],
			);
		} else {
			this.db.run("INSERT INTO memories (id, key, content, tags) VALUES (?, ?, ?, ?)", [
				`mem_${Date.now()}`,
				key,
				content,
				JSON.stringify(tags),
			]);
		}
		return this.getMemory(key)!;
	}

	searchMemories(query: string): Memory[] {
		const stmt = this.db.prepare("SELECT * FROM memories WHERE key LIKE ? OR content LIKE ?");
		stmt.bind([`%${query}%`, `%${query}%`]);
		const memories: Memory[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject();
			memories.push({
				id: row.id as string,
				key: row.key as string,
				content: row.content as string,
				tags: JSON.parse(row.tags as string),
				createdAt: (row.created_at as number) * 1000,
				updatedAt: (row.updated_at as number) * 1000,
			});
		}
		stmt.free();
		return memories;
	}

	getMemory(key: string): Memory | null {
		const stmt = this.db.prepare("SELECT * FROM memories WHERE key = ?");
		stmt.bind([key]);
		if (!stmt.step()) {
			stmt.free();
			return null;
		}
		const row = stmt.getAsObject();
		stmt.free();
		return {
			id: row.id as string,
			key: row.key as string,
			content: row.content as string,
			tags: JSON.parse(row.tags as string),
			createdAt: (row.created_at as number) * 1000,
			updatedAt: (row.updated_at as number) * 1000,
		};
	}

	deleteMemory(key: string): boolean {
		this.db.run("DELETE FROM memories WHERE key = ?", [key]);
		return this.db.getRowsModified() > 0;
	}
}
