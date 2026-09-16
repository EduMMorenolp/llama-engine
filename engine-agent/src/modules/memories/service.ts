import type { Database } from "sql.js";
import type { Memory } from "../../sessions/types.js";

export class MemoryService {
	constructor(private db: Database) {}

	search(query: string): Memory[] {
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

	upsert(key: string, content: string, tags: string[]): Memory {
		const existing = this.get(key);
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
		return this.get(key)!;
	}

	get(key: string): Memory | null {
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

	delete(key: string): boolean {
		this.db.run("DELETE FROM memories WHERE key = ?", [key]);
		return this.db.getRowsModified() > 0;
	}
}
