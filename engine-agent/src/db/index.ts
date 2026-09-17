import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { getConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
	if (db) return db;

	const config = getConfig();
	const filePath = config.DB_PATH;

	logger.info(`Opening database at ${filePath}`);

	const SQL = await initSqlJs();
	const dir = path.dirname(filePath);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

	if (fs.existsSync(filePath)) {
		const buffer = fs.readFileSync(filePath);
		db = new SQL.Database(buffer);
	} else {
		db = new SQL.Database();
	}

	db.run("PRAGMA journal_mode = WAL");
	db.run("PRAGMA foreign_keys = ON");

	runMigrations(db);
	return db;
}

export function getDbSync(): Database {
	if (!db) throw new Error("Database not initialized. Call getDb() first.");
	return db;
}

export function saveDb(): void {
	try {
		const config = getConfig();
		if (db && config.DB_PATH && config.DB_PATH !== ":memory:") {
			const dir = path.dirname(config.DB_PATH);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			const data = db.export();
			const buffer = Buffer.from(data);
			fs.writeFileSync(config.DB_PATH, buffer);
		}
	} catch (err) {
		logger.warn(`Error al persistir base de datos: ${err}`);
	}
}

export function closeDb(): void {
	if (db) {
		saveDb();
		db.close();
		db = null;
		logger.info("Database closed");
	}
}

function runMigrations(db: Database): void {
	db.run(`
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			name TEXT,
			model TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		)
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
		)
	`);
	db.run(`
		CREATE TABLE IF NOT EXISTS memories (
			id TEXT PRIMARY KEY,
			key TEXT NOT NULL UNIQUE,
			content TEXT NOT NULL,
			tags TEXT DEFAULT '[]',
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		)
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
		)
	`);
	db.run("CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);");
	db.run("CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);");

	logger.info("Migrations applied");
}
