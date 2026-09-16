import type { ToolSpec } from "./types.js";

export const globSearchTool: ToolSpec = {
	type: "function",
	function: {
		name: "glob_search",
		description: "Buscar archivos por patrón (glob)",
		parameters: {
			type: "object",
			properties: {
				pattern: { type: "string", description: "Patrón glob (ej: **/*.ts)" },
				path: { type: "string", description: "Directorio base (opcional)" },
			},
			required: ["pattern"],
		},
	},
};

export const grepSearchTool: ToolSpec = {
	type: "function",
	function: {
		name: "grep_search",
		description: "Buscar contenido en archivos por regex",
		parameters: {
			type: "object",
			properties: {
				pattern: { type: "string", description: "Regex pattern" },
				path: { type: "string", description: "Directorio o archivo (opcional)" },
			},
			required: ["pattern"],
		},
	},
};
