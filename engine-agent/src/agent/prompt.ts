import type { SessionStore } from "../sessions/store.js";
import type { LLMMessage } from "./types.js";

export interface PromptContext {
	store: SessionStore;
	sessionId: string;
	systemPrompt?: string;
	memories?: Array<{ key: string; content: string }>;
	maxHistoryChars?: number;
}

const DEFAULT_MAX_HISTORY_CHARS = 60000; // ~15,000 tokens safe budget

export function buildPrompt(context: PromptContext): LLMMessage[] {
	const {
		store,
		sessionId,
		systemPrompt,
		memories,
		maxHistoryChars = DEFAULT_MAX_HISTORY_CHARS,
	} = context;
	const messages: LLMMessage[] = [];

	const systemParts: string[] = [];
	systemParts.push(systemPrompt ?? "Sos un asistente útil y amigable.");

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
		let content = msg.content ?? "";
		// Safety cap on individual messages in history (e.g. 12KB)
		if (content.length > 12000) {
			content = `${content.slice(0, 6000)}\n\n... [Contenido truncado para ajuste de contexto] ...\n\n${content.slice(-6000)}`;
		}

		if (msg.role === "tool") {
			convertedMessages.push({
				role: "tool",
				content,
				tool_call_id: msg.toolCallId ?? undefined,
			});
		} else if (msg.toolCalls) {
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
		} else {
			convertedMessages.push({
				role: msg.role as "user" | "assistant",
				content,
			});
		}
	}

	// Calculate total characters and trim from earliest messages if exceeding budget
	let totalChars = convertedMessages.reduce(
		(sum, m) => sum + (typeof m.content === "string" ? m.content.length : 0),
		0,
	);

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
