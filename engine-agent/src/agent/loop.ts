import { randomUUID } from "node:crypto";
import type { SessionStore } from "../sessions/store.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { ToolContext } from "../tools/types.js";
import type { LLMClient } from "./llm-client.js";
import { buildPrompt, getMemoriesForContext } from "./prompt.js";
import type {
	AgentOptions,
	AgentResult,
	LLMMessage,
	StreamEvent,
	ToolCallResult,
} from "./types.js";

export interface AgentLoopConfig {
	llmClient: LLMClient;
	toolRegistry: ToolRegistry;
	store: SessionStore;
	maxIterations: number;
	workDir: string;
}

export async function runAgent(
	config: AgentLoopConfig,
	options: AgentOptions,
	onEvent?: (event: StreamEvent) => void,
): Promise<AgentResult> {
	const { llmClient, toolRegistry, store, maxIterations, workDir } = config;
	const { sessionId, message, model, systemPrompt } = options;

	const userMsgId = randomUUID();
	store.addMessage(userMsgId, sessionId, "user", message);

	const memories = getMemoriesForContext(store);
	const tools = toolRegistry.getSpecs();
	const toolContext: ToolContext = { sessionId, workDir, store };

	const messages: LLMMessage[] = buildPrompt({
		store,
		sessionId,
		systemPrompt,
		memories,
	});

	const allToolCalls: ToolCallResult[] = [];
	let iterations = 0;
	let finalContent = "";

	for (let i = 0; i < maxIterations; i++) {
		iterations++;
		const response = await llmClient.sendMessage(messages, tools, model);

		if (response.tool_calls && response.tool_calls.length > 0) {
			const assistantMsgId = randomUUID();
			store.addMessage(
				assistantMsgId,
				sessionId,
				"assistant",
				response.content,
				JSON.stringify(response.tool_calls),
			);

			messages.push({
				role: "assistant",
				content: response.content,
				tool_calls: response.tool_calls,
			});

			for (const tc of response.tool_calls) {
				const callId = tc.id || randomUUID();
				let args: Record<string, unknown> = {};
				try {
					args = JSON.parse(tc.function.arguments);
				} catch {
					args = { raw: tc.function.arguments };
				}

				onEvent?.({
					type: "tool_start",
					payload: { id: callId, name: tc.function.name, args },
				});

				let result: string;
				try {
					result = await toolRegistry.execute(tc.function.name, args, toolContext);
				} catch (err: any) {
					result = `Error: ${err.message}`;
				}

				allToolCalls.push({ name: tc.function.name, args, result });
				onEvent?.({
					type: "tool_end",
					payload: { id: callId, name: tc.function.name, result },
				});

				const toolMsgId = randomUUID();
				store.addMessage(toolMsgId, sessionId, "tool", result, null, callId);

				messages.push({
					role: "tool",
					content: result,
					tool_call_id: callId,
				});
			}
		} else {
			finalContent = response.content ?? "";
			if (finalContent) {
				onEvent?.({ type: "message", payload: { role: "assistant", content: finalContent } });
				const assistantMsgId = randomUUID();
				store.addMessage(assistantMsgId, sessionId, "assistant", finalContent);
			}
			break;
		}
	}

	// If loop terminated without text message after tool executions, provide closure
	if (!finalContent && allToolCalls.length > 0) {
		finalContent = "He completado la ejecución de las herramientas.";
		onEvent?.({ type: "message", payload: { role: "assistant", content: finalContent } });
		const assistantMsgId = randomUUID();
		store.addMessage(assistantMsgId, sessionId, "assistant", finalContent);
	}

	const msgId = randomUUID();
	onEvent?.({ type: "done", payload: { messageId: msgId } });

	return {
		content: finalContent,
		toolCalls: allToolCalls,
		iterations,
	};
}
