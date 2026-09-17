import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerAllTools } from "./index.js";
import { ToolRegistry } from "./registry.js";
import type { ToolContext } from "./types.js";

vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
}));

function createMockContext(overrides?: { store?: Partial<ToolContext["store"]> }): ToolContext {
	return {
		sessionId: "test-session",
		workDir: "/tmp",
		store: {
			upsertMemory: vi.fn(),
			searchMemories: vi.fn().mockReturnValue([]),
			...overrides?.store,
		} as any,
	};
}

const TMP_DIR = join(import.meta.dirname ?? ".", "__test_tmp__");

beforeEach(() => {
	if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
});

function makeRegistry(): { registry: ToolRegistry; ctx: ToolContext } {
	const registry = new ToolRegistry();
	registerAllTools(registry);
	const ctx = createMockContext();
	return { registry, ctx };
}

describe("truncate (via readFileHandler)", () => {
	it("returns text as-is when under limit", async () => {
		const { registry, ctx } = makeRegistry();
		const tmpFile = join(TMP_DIR, "short.txt");
		mkdirSync(TMP_DIR, { recursive: true });
		writeFileSync(tmpFile, "hello");
		const result = await registry.execute("read_file", { path: tmpFile }, ctx);
		expect(result).toBe("hello");
	});

	it("truncates text exceeding limit", async () => {
		const { registry, ctx } = makeRegistry();
		const tmpFile = join(TMP_DIR, "long.txt");
		mkdirSync(TMP_DIR, { recursive: true });
		writeFileSync(tmpFile, "x".repeat(20000));
		const result = await registry.execute("read_file", { path: tmpFile }, ctx);
		expect(result).toContain("Contenido truncado");
		expect(result).toContain("20000 caracteres totales");
	});
});

describe("bash", () => {
	it("executes command and returns output", async () => {
		const { registry, ctx } = makeRegistry();
		const { execSync } = await import("node:child_process");
		vi.mocked(execSync).mockReturnValue("output here\n");
		const result = await registry.execute("bash", { command: "echo hello" }, ctx);
		expect(result).toBe("output here\n");
		expect(execSync).toHaveBeenCalledWith("echo hello", {
			encoding: "utf8",
			timeout: 30000,
			maxBuffer: 5 * 1024 * 1024,
		});
	});

	it("returns stderr on failure", async () => {
		const { registry, ctx } = makeRegistry();
		const { execSync } = await import("node:child_process");
		const err = new Error("cmd failed") as any;
		err.stderr = "error output";
		vi.mocked(execSync).mockImplementation(() => {
			throw err;
		});
		const result = await registry.execute("bash", { command: "bad cmd" }, ctx);
		expect(result).toBe("error output");
	});

	it("falls back to stdout when stderr is empty", async () => {
		const { registry, ctx } = makeRegistry();
		const { execSync } = await import("node:child_process");
		const err = new Error("fail") as any;
		err.stderr = "";
		err.stdout = "some stdout";
		vi.mocked(execSync).mockImplementation(() => {
			throw err;
		});
		const result = await registry.execute("bash", { command: "cmd" }, ctx);
		expect(result).toBe("some stdout");
	});

	it("falls back to message when no stderr/stdout", async () => {
		const { registry, ctx } = makeRegistry();
		const { execSync } = await import("node:child_process");
		vi.mocked(execSync).mockImplementation(() => {
			throw new Error("generic error");
		});
		const result = await registry.execute("bash", { command: "cmd" }, ctx);
		expect(result).toBe("generic error");
	});
});

describe("read_file", () => {
	it("reads file content", async () => {
		const { registry, ctx } = makeRegistry();
		const tmpFile = join(TMP_DIR, "read.txt");
		mkdirSync(TMP_DIR, { recursive: true });
		writeFileSync(tmpFile, "file content here");
		const result = await registry.execute("read_file", { path: tmpFile }, ctx);
		expect(result).toBe("file content here");
	});

	it("returns error for non-existent file", async () => {
		const { registry, ctx } = makeRegistry();
		mkdirSync(TMP_DIR, { recursive: true });
		const result = await registry.execute("read_file", { path: join(TMP_DIR, "nope.txt") }, ctx);
		expect(result).toContain("no existe");
	});

	it("returns error for directory", async () => {
		const { registry, ctx } = makeRegistry();
		mkdirSync(TMP_DIR, { recursive: true });
		const result = await registry.execute("read_file", { path: TMP_DIR }, ctx);
		expect(result).toContain("es un directorio");
	});
});

describe("write_file", () => {
	it("writes file and creates parent directories", async () => {
		const { registry, ctx } = makeRegistry();
		const tmpFile = join(TMP_DIR, "sub", "write.txt");
		const result = await registry.execute("write_file", { path: tmpFile, content: "new content" }, ctx);
		expect(result).toContain("correctamente");
		expect(readFileSync(tmpFile, "utf8")).toBe("new content");
	});
});

describe("edit_file", () => {
	it("edits file by replacing text", async () => {
		const { registry, ctx } = makeRegistry();
		const tmpFile = join(TMP_DIR, "edit.txt");
		mkdirSync(TMP_DIR, { recursive: true });
		writeFileSync(tmpFile, "hello world");
		const result = await registry.execute(
			"edit_file",
			{ path: tmpFile, oldText: "world", newText: "there" },
			ctx,
		);
		expect(result).toBe("Archivo editado correctamente");
		expect(readFileSync(tmpFile, "utf8")).toBe("hello there");
	});

	it("returns error when text not found", async () => {
		const { registry, ctx } = makeRegistry();
		const tmpFile = join(TMP_DIR, "edit2.txt");
		mkdirSync(TMP_DIR, { recursive: true });
		writeFileSync(tmpFile, "hello world");
		const result = await registry.execute(
			"edit_file",
			{ path: tmpFile, oldText: "xyz", newText: "abc" },
			ctx,
		);
		expect(result).toContain("texto no encontrado");
	});

	it("returns error for non-existent file", async () => {
		const { registry, ctx } = makeRegistry();
		mkdirSync(TMP_DIR, { recursive: true });
		const result = await registry.execute(
			"edit_file",
			{ path: join(TMP_DIR, "nope.txt"), oldText: "a", newText: "b" },
			ctx,
		);
		expect(result).toContain("no existe");
	});
});

describe("glob_search", () => {
	it("finds files matching pattern", async () => {
		const { registry, ctx } = makeRegistry();
		mkdirSync(TMP_DIR, { recursive: true });
		writeFileSync(join(TMP_DIR, "a.txt"), "");
		writeFileSync(join(TMP_DIR, "b.txt"), "");
		const result = await registry.execute("glob_search", { pattern: "*.txt", path: TMP_DIR }, ctx);
		expect(result).toContain("a.txt");
		expect(result).toContain("b.txt");
	});

	it("returns message when no files found", async () => {
		const { registry, ctx } = makeRegistry();
		mkdirSync(TMP_DIR, { recursive: true });
		const result = await registry.execute("glob_search", { pattern: "*.xyz", path: TMP_DIR }, ctx);
		expect(result).toBe("No se encontraron archivos");
	});

	it("filters out ignored directories", async () => {
		const { registry, ctx } = makeRegistry();
		mkdirSync(join(TMP_DIR, "node_modules"), { recursive: true });
		writeFileSync(join(TMP_DIR, "node_modules", "dep.js"), "");
		writeFileSync(join(TMP_DIR, "app.js"), "");
		const result = await registry.execute("glob_search", { pattern: "*.js", path: TMP_DIR }, ctx);
		expect(result).toContain("app.js");
		expect(result).not.toContain("dep.js");
	});
});

describe("grep_search", () => {
	it("finds matching lines", async () => {
		const { registry, ctx } = makeRegistry();
		mkdirSync(TMP_DIR, { recursive: true });
		writeFileSync(join(TMP_DIR, "code.ts"), "const x = 1;\nconst y = 2;\nconst z = 3;");
		const result = await registry.execute("grep_search", { pattern: "const y", path: TMP_DIR }, ctx);
		expect(result).toContain("code.ts:2:");
		expect(result).toContain("const y = 2");
	});

	it("returns message when no matches", async () => {
		const { registry, ctx } = makeRegistry();
		mkdirSync(TMP_DIR, { recursive: true });
		writeFileSync(join(TMP_DIR, "code.ts"), "const x = 1;");
		const result = await registry.execute(
			"grep_search",
			{ pattern: "function", path: TMP_DIR },
			ctx,
		);
		expect(result).toBe("No se encontraron coincidencias");
	});

	it("skips ignored directories", async () => {
		const { registry, ctx } = makeRegistry();
		mkdirSync(join(TMP_DIR, "node_modules"), { recursive: true });
		writeFileSync(join(TMP_DIR, "node_modules", "dep.js"), "const x = 1;");
		writeFileSync(join(TMP_DIR, "app.js"), "const y = 2;");
		const result = await registry.execute("grep_search", { pattern: "const", path: TMP_DIR }, ctx);
		expect(result).toContain("app.js");
		expect(result).not.toContain("dep.js");
	});
});

describe("memorize", () => {
	it("calls upsertMemory with parsed tags", async () => {
		const { registry, ctx } = makeRegistry();
		const result = await registry.execute(
			"memorize",
			{ key: "user_name", content: "Eduardo", tags: "lang,es" },
			ctx,
		);
		expect(result).toContain("guardada");
		expect(ctx.store.upsertMemory).toHaveBeenCalledWith("user_name", "Eduardo", ["lang", "es"]);
	});

	it("handles missing tags as empty array", async () => {
		const { registry, ctx } = makeRegistry();
		await registry.execute("memorize", { key: "k", content: "c" }, ctx);
		expect(ctx.store.upsertMemory).toHaveBeenCalledWith("k", "c", []);
	});

	it("trims whitespace from tags", async () => {
		const { registry, ctx } = makeRegistry();
		await registry.execute("memorize", { key: "k", content: "c", tags: " a , b " }, ctx);
		expect(ctx.store.upsertMemory).toHaveBeenCalledWith("k", "c", ["a", "b"]);
	});
});

describe("search_memories", () => {
	it("returns formatted memories", async () => {
		const ctx = createMockContext({
			store: {
				searchMemories: vi.fn().mockReturnValue([
					{ key: "name", content: "Eduardo" },
					{ key: "lang", content: "Español" },
				]),
			},
		});
		const registry = new ToolRegistry();
		registerAllTools(registry);
		const result = await registry.execute("search_memories", { query: "test" }, ctx);
		expect(result).toBe("name: Eduardo\nlang: Español");
	});

	it("returns message when no results", async () => {
		const ctx = createMockContext({
			store: { searchMemories: vi.fn().mockReturnValue([]) },
		});
		const registry = new ToolRegistry();
		registerAllTools(registry);
		const result = await registry.execute("search_memories", { query: "xyz" }, ctx);
		expect(result).toBe("No se encontraron memorias");
	});
});

describe("update_memory", () => {
	it("calls upsertMemory with empty tags", async () => {
		const { registry, ctx } = makeRegistry();
		const result = await registry.execute("update_memory", { key: "k", content: "new" }, ctx);
		expect(result).toContain("actualizada");
		expect(ctx.store.upsertMemory).toHaveBeenCalledWith("k", "new", []);
	});
});

describe("registerAllTools", () => {
	it("registers all 9 tools", () => {
		const registry = new ToolRegistry();
		registerAllTools(registry);
		const specs = registry.getSpecs();
		expect(specs.length).toBe(9);
		const names = specs.map((s) => s.function.name);
		expect(names).toContain("bash");
		expect(names).toContain("read_file");
		expect(names).toContain("write_file");
		expect(names).toContain("edit_file");
		expect(names).toContain("glob_search");
		expect(names).toContain("grep_search");
		expect(names).toContain("memorize");
		expect(names).toContain("search_memories");
		expect(names).toContain("update_memory");
	});
});
