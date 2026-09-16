import type { ToolSpec } from "./types.js";

export const bashTool: ToolSpec = {
	type: "function",
	function: {
		name: "bash",
		description: "Ejecutar comandos en el sistema",
		parameters: {
			type: "object",
			properties: {
				command: { type: "string", description: "Comando a ejecutar" },
			},
			required: ["command"],
		},
	},
};
