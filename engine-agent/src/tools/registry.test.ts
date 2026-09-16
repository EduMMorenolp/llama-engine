import { beforeEach, describe, expect, it } from "vitest";
import { ToolRegistry } from "./registry.js";
import type { ToolContext, ToolHandler, ToolSpec } from "./types.js";

const mockContext: ToolContext = {
	sessionId: "test-session",
	workDir: "/tmp",
	store: {} as any,
};

const testTool: ToolSpec = {
	type: "function",
	function: {
		name: "test_tool",
		description: "A test tool",
		parameters: {
			type: "object",
			properties: {
				input: { type: "string", description: "Test input" },
			},
			required: ["input"],
		},
	},
};

const testHandler: ToolHandler = async (args) => `result: ${args.input}`;

describe("ToolRegistry", () => {
	let registry: ToolRegistry;

	beforeEach(() => {
		registry = new ToolRegistry();
	});

	it("register adds a tool to the registry", () => {
		registry.register(testTool, testHandler);
		const tool = registry.get("test_tool");
		expect(tool).toBeDefined();
		expect(tool?.spec.function.name).toBe("test_tool");
		expect(tool?.enabled).toBe(true);
	});

	it("execute calls the handler and returns result", async () => {
		registry.register(testTool, testHandler);
		const result = await registry.execute("test_tool", { input: "hello" }, mockContext);
		expect(result).toBe("result: hello");
	});

	it("execute throws if tool not found", async () => {
		await expect(registry.execute("nonexistent", {}, mockContext)).rejects.toThrow(
			'Tool "nonexistent" no encontrado',
		);
	});

	it("execute throws if tool is disabled", async () => {
		registry.register(testTool, testHandler, false);
		await expect(registry.execute("test_tool", { input: "hello" }, mockContext)).rejects.toThrow(
			'Tool "test_tool" está deshabilitado',
		);
	});

	it("getSpecs returns OpenAI function-calling format", () => {
		registry.register(testTool, testHandler);
		const specs = registry.getSpecs();
		expect(specs).toHaveLength(1);
		expect(specs[0]).toEqual(testTool);
	});

	it("getSpecs excludes disabled tools", () => {
		registry.register(testTool, testHandler, false);
		const specs = registry.getSpecs();
		expect(specs).toHaveLength(0);
	});

	it("custom tools can be registered and removed", () => {
		registry.registerCustomTool(
			{
				name: "custom",
				description: "Custom tool",
				parameters: { type: "object", properties: { x: { type: "string" } } },
				handlerType: "bash",
				handlerConfig: { command: "echo {{x}}" },
			},
			async () => "custom result",
		);
		expect(registry.get("custom")).toBeDefined();
		expect(registry.unregister("custom")).toBe(true);
		expect(registry.get("custom")).toBeUndefined();
	});

	it("setEnabled toggles tool state", () => {
		registry.register(testTool, testHandler);
		expect(registry.isEnabled("test_tool")).toBe(true);
		registry.setEnabled("test_tool", false);
		expect(registry.isEnabled("test_tool")).toBe(false);
	});

	it("enableAll and disableAll toggle all tools", () => {
		registry.register(testTool, testHandler);
		registry.register(
			{ ...testTool, function: { ...testTool.function, name: "other" } },
			testHandler,
		);
		registry.disableAll();
		expect(registry.getSpecs()).toHaveLength(0);
		registry.enableAll();
		expect(registry.getSpecs()).toHaveLength(2);
	});

	it("list returns all tools with their state", () => {
		registry.register(testTool, testHandler);
		registry.register(
			{ ...testTool, function: { ...testTool.function, name: "other" } },
			testHandler,
			false,
		);
		const list = registry.list();
		expect(list).toHaveLength(2);
		expect(list.find((t) => t.name === "test_tool")?.enabled).toBe(true);
		expect(list.find((t) => t.name === "other")?.enabled).toBe(false);
	});
});
