import type { Database } from "sql.js";
import { NotFoundException } from "../../common/exceptions/http-exception.js";
import { saveDb } from "../../db/index.js";
import type { Message, Session } from "../../sessions/types.js";
import type { CreateSessionDto } from "./dto.js";

export class SessionService {
	constructor(private db: Database) {}

	createSession(dto: CreateSessionDto): Session {
		const id = dto.id || crypto.randomUUID();
		this.db.run("INSERT INTO sessions (id, name, model) VALUES (?, ?, ?)", [
			id,
			dto.name ?? null,
			dto.model ?? null,
		]);
		saveDb();
		return this.getSession(id);
	}

	getSession(id: string): Session {
		const stmt = this.db.prepare("SELECT * FROM sessions WHERE id = ?");
		stmt.bind([id]);
		if (!stmt.step()) {
			stmt.free();
			throw new NotFoundException(`Sesión ${id} no encontrada`);
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
		const modified = this.db.getRowsModified() > 0;
		if (modified) {
			saveDb();
		}
		return modified;
	}

	updateSession(id: string, dto: import("./dto.js").UpdateSessionDto): Session {
		this.getSession(id);
		const fields: string[] = [];
		const values: unknown[] = [];
		if (dto.name !== undefined) {
			fields.push("name = ?");
			values.push(dto.name);
		}
		if (dto.model !== undefined) {
			fields.push("model = ?");
			values.push(dto.model);
		}
		if (fields.length > 0) {
			fields.push("updated_at = unixepoch()");
			values.push(id);
			this.db.run(`UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`, values as any[]);
			saveDb();
		}
		return this.getSession(id);
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
}
