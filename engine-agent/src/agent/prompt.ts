import type { SessionStore } from "../sessions/store.js";
import type { LLMMessage } from "./types.js";

export interface PromptContext {
	store: SessionStore;
	sessionId: string;
	systemPrompt?: string;
	memories?: Array<{ key: string; content: string }>;
	maxHistoryChars?: number;
	model?: string;
}

const DEFAULT_MAX_HISTORY_CHARS = 60000; // ~15,000 tokens safe budget

export function buildPrompt(context: PromptContext): LLMMessage[] {
	const {
		store,
		sessionId,
		systemPrompt,
		memories,
		maxHistoryChars = DEFAULT_MAX_HISTORY_CHARS,
		model: _model,
	} = context;
	const messages: LLMMessage[] = [];

	const systemParts: string[] = [];
	systemParts.push(systemPrompt ?? "Sos un asistente de IA inteligente, empático y servicial.");

	systemParts.push(`
## Gestión de Memoria
Tenés acceso a herramientas de memoria persistente. Usalas siempre que sea relevante:

- **search_memories**: Al inicio de cada conversación, buscá si hay memorias previas del usuario (nombre, idioma, preferencias, contexto). Esto te permite personalizar tu respuesta.
- **memorize**: Cuando el usuario te comparta información personal (nombre, idioma, preferencias, ocupación, gustos), guardala con una clave descriptiva y contenido claro. Ejemplo: key="user_name", content="Eduardo".
- **update_memory**: Si la información del usuario cambia, actualizá la memoria existente.

Reglas:
1. Si no encontrás memorias al buscar, no inventes — simplemente preguntá o continuá sin contexto previo.
2. No guardes información temporal o irrelevante (como "el usuario preguntó por el clima").
3. Usá claves en snake_case descriptivas (ej: user_name, user_lang, user preferences).
4. Cuando actualices, mantené el formato existente.`);

	if (memories && memories.length > 0) {
		systemParts.push("\n## Memoria del usuario:");
		for (const mem of memories) {
			systemParts.push(`- ${mem.key}: ${mem.content}`);
		}
	}

	messages.push({ role: "system", content: systemParts.join("\n") });

	const rawHistory = store.getMessages(sessionId);
	const convertedMessages: LLMMessage[] = [];

	for (const msg of rawHistory) {
		const rawContent = msg.content ?? "";

		// Check for embedded markdown base64 images: ![alt](data:image/...;base64,...)
		const imageMatch = rawContent.match(/!\[(.*?)\]\((data:image\/[^;]+;base64,[^)]+)\)/);

		if (msg.role === "tool") {
			let content = rawContent;
			if (content.length > 12000) {
				content = `${content.slice(0, 6000)}\n\n... [Contenido truncado para ajuste de contexto] ...\n\n${content.slice(-6000)}`;
			}
			convertedMessages.push({
				role: "tool",
				content,
				tool_call_id: msg.toolCallId ?? undefined,
			});
		} else if (msg.toolCalls) {
			let content = rawContent;
			if (content.length > 12000) {
				content = `${content.slice(0, 6000)}\n\n... [Contenido truncado para ajuste de contexto] ...\n\n${content.slice(-6000)}`;
			}
			try {
				convertedMessages.push({
					role: "assistant",
					content: content || null,
					tool_calls: JSON.parse(msg.toolCalls),
				});
			} catch {
				convertedMessages.push({
					role: "assistant",
					content,
				});
			}
		} else if (msg.role === "user" && imageMatch) {
			const imageUrl = imageMatch[2];
			let textPart = rawContent.replace(imageMatch[0], "").trim();
			if (textPart.length > 12000) {
				textPart = `${textPart.slice(0, 6000)}\n\n... [Contenido truncado] ...\n\n${textPart.slice(-6000)}`;
			}

			convertedMessages.push({
				role: "user",
				content: [
					{ type: "text", text: textPart || "Por favor analiza la imagen adjunta." },
					{ type: "image_url", image_url: { url: imageUrl } },
				],
			});
		} else {
			let content = rawContent;
			if (content.length > 12000) {
				content = `${content.slice(0, 6000)}\n\n... [Contenido truncado para ajuste de contexto] ...\n\n${content.slice(-6000)}`;
			}
			convertedMessages.push({
				role: msg.role as "user" | "assistant",
				content,
			});
		}
	}

	// Calculate total characters (ignoring image base64 length for budget calculation)
	let totalChars = convertedMessages.reduce((sum, m) => {
		if (typeof m.content === "string") return sum + m.content.length;
		if (Array.isArray(m.content)) {
			return (
				sum +
				m.content.reduce((innerSum, part) => {
					if (part.type === "text" && part.text) return innerSum + part.text.length;
					return innerSum + 1000; // Count image as equivalent ~250 tokens
				}, 0)
			);
		}
		return sum;
	}, 0);

	if (totalChars > maxHistoryChars && convertedMessages.length > 2) {
		// Keep the first message (initial intent) and latest messages
		const initialUserMsg = convertedMessages[0];
		const recentMessages: LLMMessage[] = [];

		for (let i = convertedMessages.length - 1; i >= 1; i--) {
			const m = convertedMessages[i];
			const len = typeof m.content === "string" ? m.content.length : 0;
			if (totalChars > maxHistoryChars && recentMessages.length >= 2) {
				totalChars -= len;
				continue;
			}
			recentMessages.unshift(m);
		}

		messages.push(initialUserMsg, ...recentMessages);
	} else {
		messages.push(...convertedMessages);
	}

	return messages;
}

export function getMemoriesForContext(
	store: SessionStore,
): Array<{ key: string; content: string }> {
	return store.searchMemories("").map((m) => ({ key: m.key, content: m.content }));
}
