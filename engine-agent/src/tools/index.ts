import { execSync } from "node:child_process";
import fs from "node:fs";
import { glob } from "node:fs/promises";
import path from "node:path";
import { bashTool } from "./bash.js";
import { editFileTool, readFileTool, writeFileTool } from "./file-ops.js";
import { memorizeTool, searchMemoriesTool, updateMemoryTool } from "./memory.js";
import type { ToolRegistry } from "./registry.js";
import { globSearchTool, grepSearchTool } from "./search.js";
import type { ToolHandler } from "./types.js";

const MAX_OUTPUT_CHARS = 12000; // ~3000 tokens max per tool execution
const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "data", ".gemini", ".vscode", "coverage"]);

function truncate(text: string, limit = MAX_OUTPUT_CHARS): string {
	if (!text || text.length <= limit) return text;
	const half = Math.floor(limit / 2);
	const head = text.slice(0, half);
	const tail = text.slice(-half);
	return `${head}\n\n... [Contenido truncado (${text.length} caracteres totales). Usa parámetros o rangos más específicos] ...\n\n${tail}`;
}

const bashHandler: ToolHandler = async (args) => {
	const command = String(args.command);
	try {
		const stdout = execSync(command, { encoding: "utf8", timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
		return truncate(stdout);
	} catch (err: any) {
		return truncate(err.stderr || err.stdout || err.message);
	}
};

const readFileHandler: ToolHandler = async (args) => {
	const filePath = String(args.path);
	try {
		if (!fs.existsSync(filePath)) {
			return `Error: el archivo "${filePath}" no existe.`;
		}
		const stat = fs.statSync(filePath);
		if (stat.isDirectory()) {
			return `Error: "${filePath}" es un directorio, usa glob_search para listar archivos.`;
		}
		const content = fs.readFileSync(filePath, "utf8");
		return truncate(content);
	} catch (err: any) {
		return `Error leyendo archivo: ${err.message}`;
	}
};

const writeFileHandler: ToolHandler = async (args) => {
	const filePath = String(args.path);
	const content = String(args.content);
	try {
		const dir = path.dirname(filePath);
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(filePath, content, "utf8");
		return `Archivo escrito correctamente (${content.length} caracteres)`;
	} catch (err: any) {
		return `Error escribiendo archivo: ${err.message}`;
	}
};

const editFileHandler: ToolHandler = async (args) => {
	const filePath = String(args.path);
	const oldText = String(args.oldText);
	const newText = String(args.newText);
	try {
		if (!fs.existsSync(filePath)) {
			return `Error: el archivo "${filePath}" no existe.`;
		}
		let content = fs.readFileSync(filePath, "utf8");
		if (!content.includes(oldText)) return "Error: texto no encontrado en el archivo";
		content = content.replace(oldText, newText);
		fs.writeFileSync(filePath, content, "utf8");
		return "Archivo editado correctamente";
	} catch (err: any) {
		return `Error editando archivo: ${err.message}`;
	}
};

const globSearchHandler: ToolHandler = async (args) => {
	const pattern = String(args.pattern || "*");
	const basePath = args.path ? String(args.path) : ".";
	try {
		const files: string[] = [];
		for await (const entry of glob(pattern, { cwd: basePath })) {
			const parts = entry.split(/[\\/]/);
			if (parts.some((p) => IGNORED_DIRS.has(p))) continue;
			files.push(entry);
			if (files.length >= 100) {
				files.push("... [Límite de 100 archivos alcanzado]");
				break;
			}
		}
		return files.length ? files.join("\n") : "No se encontraron archivos";
	} catch (err: any) {
		return `Error en búsqueda: ${err.message}`;
	}
};

const grepSearchHandler: ToolHandler = async (args) => {
	const pattern = String(args.pattern);
	const searchPath = args.path ? String(args.path) : ".";
	try {
		const regex = new RegExp(pattern, "gi");
		const results: string[] = [];

		function searchInPath(currentPath: string) {
			if (results.length >= 60) return;
			const baseName = path.basename(currentPath);
			if (IGNORED_DIRS.has(baseName)) return;

			let stat: fs.Stats;
			try {
				stat = fs.statSync(currentPath);
			} catch {
				return;
			}

			if (stat.isFile()) {
				if (stat.size > 1024 * 1024) return; // skip files > 1MB
				try {
					const content = fs.readFileSync(currentPath, "utf8");
					const lines = content.split("\n");
					for (let i = 0; i < lines.length; i++) {
						if (regex.test(lines[i])) {
							results.push(`${currentPath}:${i + 1}: ${lines[i].trim().slice(0, 150)}`);
							if (results.length >= 60) break;
						}
						regex.lastIndex = 0;
					}
				} catch {
					// skip unreadable
				}
			} else if (stat.isDirectory()) {
				let entries: fs.Dirent[] = [];
				try {
					entries = fs.readdirSync(currentPath, { withFileTypes: true });
				} catch {
					return;
				}
				for (const entry of entries) {
					if (results.length >= 60) break;
					if (IGNORED_DIRS.has(entry.name)) continue;
					searchInPath(path.join(currentPath, entry.name));
				}
			}
		}

		searchInPath(searchPath);

		if (results.length >= 60) {
			results.push("... [Límite de 60 coincidencias alcanzado]");
		}

		return results.length ? results.join("\n") : "No se encontraron coincidencias";
	} catch (err: any) {
		return `Error en búsqueda: ${err.message}`;
	}
};

const memorizeHandler: ToolHandler = async (args, ctx) => {
	const key = String(args.key);
	const content = String(args.content);
	const tags = args.tags
		? String(args.tags)
				.split(",")
				.map((t) => t.trim())
		: [];
	ctx.store.upsertMemory(key, content, tags);
	return `Memoria "${key}" guardada`;
};

const searchMemoriesHandler: ToolHandler = async (args, ctx) => {
	const query = String(args.query);
	const memories = ctx.store.searchMemories(query);
	if (!memories.length) return "No se encontraron memorias";
	return memories.map((m) => `${m.key}: ${m.content}`).join("\n");
};

const updateMemoryHandler: ToolHandler = async (args, ctx) => {
	const key = String(args.key);
	const content = String(args.content);
	ctx.store.upsertMemory(key, content, []);
	return `Memoria "${key}" actualizada`;
};

export function registerAllTools(registry: ToolRegistry): void {
	registry.register(bashTool, bashHandler);
	registry.register(readFileTool, readFileHandler);
	registry.register(writeFileTool, writeFileHandler);
	registry.register(editFileTool, editFileHandler);
	registry.register(globSearchTool, globSearchHandler);
	registry.register(grepSearchTool, grepSearchHandler);
	registry.register(memorizeTool, memorizeHandler);
	registry.register(searchMemoriesTool, searchMemoriesHandler);
	registry.register(updateMemoryTool, updateMemoryHandler);
}
