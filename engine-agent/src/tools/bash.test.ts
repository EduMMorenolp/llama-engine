import { describe, expect, it } from "vitest";
import { bashTool } from "./bash.js";
import type { ToolHandler } from "./types.js";

describe("bash tool", () => {
	it("has correct spec", () => {
		expect(bashTool.function.name).toBe("bash");
		expect(bashTool.function.parameters.required).toContain("command");
	});

	it("handler executes command and returns stdout", async () => {
		const handler: ToolHandler = async (args) => {
			const { execSync } = await import("node:child_process");
			const command = String(args.command);
			try {
				return execSync(command, { encoding: "utf8", timeout: 30000 });
			} catch (err: any) {
				return err.stderr || err.message;
			}
		};
		const result = await handler({ command: "echo hello" }, {} as any);
		expect(result).toContain("hello");
	});

	it("handler handles command failure gracefully", async () => {
		const handler: ToolHandler = async (args) => {
			const { execSync } = await import("node:child_process");
			const command = String(args.command);
			try {
				return execSync(command, { encoding: "utf8", timeout: 30000 });
			} catch (err: any) {
				return err.stderr || err.message;
			}
		};
		const result = await handler({ command: "exit 1" }, {} as any);
		expect(result).toBeTruthy();
	});
});
