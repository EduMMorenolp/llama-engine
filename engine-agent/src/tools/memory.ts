import type { ToolSpec } from "./types.js";

export const memorizeTool: ToolSpec = {
	type: "function",
	function: {
		name: "memorize",
		description: "Guardar un dato en memoria persistente",
		parameters: {
			type: "object",
			properties: {
				key: { type: "string", description: "Clave de la memoria" },
				content: { type: "string", description: "Contenido a guardar" },
				tags: { type: "string", description: "Tags separados por coma (opcional)" },
			},
			required: ["key", "content"],
		},
	},
};

export const searchMemoriesTool: ToolSpec = {
	type: "function",
	function: {
		name: "search_memories",
		description: "Buscar en las memorias guardadas",
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "Texto de búsqueda" },
			},
			required: ["query"],
		},
	},
};

export const updateMemoryTool: ToolSpec = {
	type: "function",
	function: {
		name: "update_memory",
		description: "Actualizar una memoria existente",
		parameters: {
			type: "object",
			properties: {
				key: { type: "string", description: "Clave de la memoria" },
				content: { type: "string", description: "Nuevo contenido" },
			},
			required: ["key", "content"],
		},
	},
};
