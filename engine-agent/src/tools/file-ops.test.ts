import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { editFileTool, readFileTool, writeFileTool } from "./file-ops.js";
import type { ToolContext, ToolHandler } from "./types.js";

let tmpDir: string;
let mockContext: ToolContext;

beforeAll(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-test-"));
	mockContext = { sessionId: "test", workDir: tmpDir, store: {} as any };
});

afterAll(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("file-ops tools", () => {
	describe("read_file", () => {
		it("has correct spec", () => {
			expect(readFileTool.function.name).toBe("read_file");
		});

		it("reads file content", async () => {
			const filePath = path.join(tmpDir, "test.txt");
			fs.writeFileSync(filePath, "hello world");
			const handler: ToolHandler = async (args) => {
				const content = fs.readFileSync(String(args.path), "utf8");
				return content;
			};
			const result = await handler({ path: filePath }, mockContext);
			expect(result).toBe("hello world");
		});
	});

	describe("write_file", () => {
		it("has correct spec", () => {
			expect(writeFileTool.function.name).toBe("write_file");
		});

		it("creates file with content", async () => {
			const filePath = path.join(tmpDir, "new.txt");
			const handler: ToolHandler = async (args) => {
				fs.writeFileSync(String(args.path), String(args.content));
				return "Archivo escrito";
			};
			await handler({ path: filePath, content: "new content" }, mockContext);
			expect(fs.readFileSync(filePath, "utf8")).toBe("new content");
		});
	});

	describe("edit_file", () => {
		it("has correct spec", () => {
			expect(editFileTool.function.name).toBe("edit_file");
		});

		it("replaces text in file", async () => {
			const filePath = path.join(tmpDir, "edit.txt");
			fs.writeFileSync(filePath, "hello world");
			const handler: ToolHandler = async (args) => {
				const content = fs.readFileSync(String(args.path), "utf8");
				const updated = content.replace(String(args.oldText), String(args.newText));
				fs.writeFileSync(String(args.path), updated);
				return "Editado";
			};
			await handler({ path: filePath, oldText: "hello", newText: "bye" }, mockContext);
			expect(fs.readFileSync(filePath, "utf8")).toBe("bye world");
		});
	});
});
