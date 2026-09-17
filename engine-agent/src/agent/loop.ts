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
	const { sessionId, message, model, systemPrompt, enabledTools, modelSettings } = options;

	const userMsgId = randomUUID();
	store.addMessage(userMsgId, sessionId, "user", message);

	const memories = getMemoriesForContext(store);
	let tools = toolRegistry.getSpecs();
	if (enabledTools !== undefined) {
		tools = tools.filter((t) => enabledTools.includes(t.function.name));
	}
	const toolContext: ToolContext = { sessionId, workDir, store };

	const reasoningInstruction =
		modelSettings?.enableReasoning === false
			? "\n\nInstrucción de respuesta: No uses etiquetas ni bloques de pensamiento <think>. Responde directamente a la consulta."
			: "";

	const messages: LLMMessage[] = buildPrompt({
		store,
		sessionId,
		systemPrompt: (systemPrompt ?? "") + reasoningInstruction,
		memories,
		model,
	});

	const allToolCalls: ToolCallResult[] = [];
	let iterations = 0;
	let finalContent = "";

	for (let i = 0; i < maxIterations; i++) {
		iterations++;
		const toolsToPass = tools;

		let accumulatedContent = "";
		const toolCallMap: Record<number, { id: string; name: string; arguments: string }> = {};

		if (typeof llmClient.sendMessageStream === "function") {
			const stream = llmClient.sendMessageStream(messages, toolsToPass, model, modelSettings);
			for await (const chunk of stream) {
				if (chunk.type === "content" && chunk.data) {
					accumulatedContent += chunk.data;
					onEvent?.({ type: "message", payload: { role: "assistant", content: chunk.data } });
				} else if (chunk.type === "tool_call" && chunk.data) {
					const idx = chunk.data.index ?? 0;
					if (!toolCallMap[idx]) {
						toolCallMap[idx] = {
							id: chunk.data.id || randomUUID(),
							name: chunk.data.function?.name || "",
							arguments: "",
						};
					}
					if (chunk.data.id) {
						toolCallMap[idx].id = chunk.data.id;
					}
					if (chunk.data.function?.name) {
						toolCallMap[idx].name = chunk.data.function.name;
					}
					if (chunk.data.function?.arguments) {
						toolCallMap[idx].arguments += chunk.data.function.arguments;
					}
				}
			}
		} else {
			const response = await llmClient.sendMessage(messages, toolsToPass, model, modelSettings);
			accumulatedContent = response.content ?? "";
			if (accumulatedContent) {
				onEvent?.({ type: "message", payload: { role: "assistant", content: accumulatedContent } });
			}
			if (response.tool_calls) {
				response.tool_calls.forEach((tc, idx) => {
					toolCallMap[idx] = {
						id: tc.id || randomUUID(),
						name: tc.function.name,
						arguments: tc.function.arguments,
					};
				});
			}
		}

		const responseToolCalls = Object.values(toolCallMap)
			.filter((tc) => tc.name)
			.map((tc) => ({
				id: tc.id,
				type: "function" as const,
				function: {
					name: tc.name,
					arguments: tc.arguments,
				},
			}));

		if (responseToolCalls.length > 0) {
			const assistantMsgId = randomUUID();
			store.addMessage(
				assistantMsgId,
				sessionId,
				"assistant",
				accumulatedContent || null,
				JSON.stringify(responseToolCalls),
			);

			messages.push({
				role: "assistant",
				content: accumulatedContent || null,
				tool_calls: responseToolCalls,
			});

			for (const tc of responseToolCalls) {
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
			finalContent = accumulatedContent;
			if (finalContent) {
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
