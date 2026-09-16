import type { CustomToolConfig, ToolDefinition, ToolHandler, ToolSpec } from "./types.js";

export class ToolRegistry {
	private tools = new Map<string, ToolDefinition>();

	register(tool: ToolSpec, handler: ToolHandler, enabled = true): void {
		this.tools.set(tool.function.name, { spec: tool, handler, enabled });
	}

	registerCustomTool(config: CustomToolConfig, handler: ToolHandler): void {
		this.register(
			{
				type: "function",
				function: {
					name: config.name,
					description: config.description,
					parameters: config.parameters,
				},
			},
			handler,
			true,
		);
	}

	unregister(name: string): boolean {
		return this.tools.delete(name);
	}

	get(name: string): ToolDefinition | undefined {
		return this.tools.get(name);
	}

	getSpecs(): ToolSpec[] {
		return Array.from(this.tools.values())
			.filter((t) => t.enabled)
			.map((t) => t.spec);
	}

	isEnabled(name: string): boolean {
		return this.tools.get(name)?.enabled ?? false;
	}

	setEnabled(name: string, enabled: boolean): void {
		const tool = this.tools.get(name);
		if (tool) tool.enabled = enabled;
	}

	enableAll(): void {
		for (const tool of this.tools.values()) {
			tool.enabled = true;
		}
	}

	disableAll(): void {
		for (const tool of this.tools.values()) {
			tool.enabled = false;
		}
	}

	list(): Array<{ name: string; description: string; enabled: boolean }> {
		return Array.from(this.tools.values()).map((t) => ({
			name: t.spec.function.name,
			description: t.spec.function.description,
			enabled: t.enabled,
		}));
	}

	async execute(
		name: string,
		args: Record<string, unknown>,
		context: import("./types.js").ToolContext,
	): Promise<string> {
		const tool = this.tools.get(name);
		if (!tool) throw new Error(`Tool "${name}" no encontrado`);
		if (!tool.enabled) throw new Error(`Tool "${name}" está deshabilitado`);
		return tool.handler(args, context);
	}
}

export const toolRegistry = new ToolRegistry();
