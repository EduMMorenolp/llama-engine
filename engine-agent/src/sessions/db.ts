import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";

let db: Database | null = null;
let dbPath: string | null = null;

export async function getDb(filePath: string): Promise<Database> {
	if (db) return db;
	dbPath = filePath;
	const SQL = await initSqlJs();
	const dir = path.dirname(filePath);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	if (fs.existsSync(filePath)) {
		const buffer = fs.readFileSync(filePath);
		db = new SQL.Database(buffer);
	} else {
		db = new SQL.Database();
	}
	migrate(db);
	return db;
}

export function getDbSync(): Database {
	if (!db) throw new Error("Database not initialized. Call getDb() first.");
	return db;
}

export function closeDb(): void {
	if (db) {
		saveDb();
		db.close();
		db = null;
		dbPath = null;
	}
}

export function saveDb(): void {
	if (db && dbPath && dbPath !== ":memory:") {
		const data = db.export();
		const buffer = Buffer.from(data);
		fs.writeFileSync(dbPath, buffer);
	}
}

function migrate(db: Database): void {
	db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT,
      model TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
	db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT,
      tool_calls TEXT,
      tool_call_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
	db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
	db.run(`
    CREATE TABLE IF NOT EXISTS custom_tools (
      name TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      parameters TEXT NOT NULL,
      handler_type TEXT NOT NULL,
      handler_config TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
	db.run("CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);");
	db.run("CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);");
}
