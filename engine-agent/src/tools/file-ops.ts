import type { ToolSpec } from "./types.js";

export const readFileTool: ToolSpec = {
	type: "function",
	function: {
		name: "read_file",
		description: "Leer el contenido de un archivo",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Ruta del archivo" },
			},
			required: ["path"],
		},
	},
};

export const writeFileTool: ToolSpec = {
	type: "function",
	function: {
		name: "write_file",
		description: "Escribir contenido en un archivo (crea o sobreescribe)",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Ruta del archivo" },
				content: { type: "string", description: "Contenido a escribir" },
			},
			required: ["path", "content"],
		},
	},
};

export const editFileTool: ToolSpec = {
	type: "function",
	function: {
		name: "edit_file",
		description: "Reemplazar texto específico en un archivo",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Ruta del archivo" },
				oldText: { type: "string", description: "Texto a reemplazar" },
				newText: { type: "string", description: "Nuevo texto" },
			},
			required: ["path", "oldText", "newText"],
		},
	},
};
