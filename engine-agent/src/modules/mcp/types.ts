export interface MCPServerConfig {
	id: string;
	name: string;
	transport: "stdio" | "sse" | "http";
	command?: string;
	args?: string[];
	url?: string;
	env?: Record<string, string>;
	status: "connected" | "disconnected" | "error";
	toolsCount?: number;
	errorMessage?: string;
}

export interface MCPToolDefinition {
	name: string;
	description?: string;
	inputSchema?: {
		type?: string;
		properties?: Record<string, unknown>;
		required?: string[];
	};
}
