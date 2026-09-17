import OpenAI from "openai";
import type { ToolSpec } from "../tools/types.js";
import type { LLMMessage, LLMResponse, ModelSettings } from "./types.js";

export interface LLMClientConfig {
	apiUrl: string;
	apiKey: string;
	model: string;
}

export class LLMClient {
	private client: OpenAI;
	private model: string;
	private baseURL: string;

	constructor(config: LLMClientConfig) {
		const rawUrl = (config.apiUrl ?? "http://localhost:3050").trim();
		// Ensure standard /v1 endpoint suffix for OpenAI SDK compatibility
		this.baseURL = rawUrl.endsWith("/v1") ? rawUrl : `${rawUrl.replace(/\/+$/, "")}/v1`;

		this.client = new OpenAI({
			baseURL: this.baseURL,
			apiKey: config.apiKey || "llama-engine-dev",
		});
		this.model = config.model || "default";
	}

	async sendMessage(
		messages: LLMMessage[],
		tools: ToolSpec[],
		model?: string,
		modelSettings?: ModelSettings,
	): Promise<LLMResponse> {
		const useModel = model ?? this.model;
		const openaiTools =
			tools.length > 0
				? tools.map((t) => ({
						type: "function" as const,
						function: {
							name: t.function.name,
							description: t.function.description,
							parameters: t.function.parameters as unknown as Record<string, unknown>,
						},
					}))
				: undefined;

		try {
			const response = await this.client.chat.completions.create({
				model: useModel,
				messages: messages as any,
				tools: openaiTools as any,
				tool_choice: tools.length > 0 ? "auto" : undefined,
				temperature: modelSettings?.temperature,
				top_p: modelSettings?.topP,
				max_tokens: modelSettings?.maxTokens,
				presence_penalty: modelSettings?.presencePenalty,
				frequency_penalty: modelSettings?.frequencyPenalty,
				stream: false,
			});

			const choice = response.choices[0];
			if (!choice) {
				throw new Error("El modelo devolvió una respuesta vacía.");
			}

			let finalContent = choice.message.content ?? null;
			const reasoning =
				(choice.message as any).reasoning_content || (choice.message as any).reasoning;
			if (reasoning && modelSettings?.enableReasoning !== false) {
				finalContent = `<think>\n${String(reasoning).trim()}\n</think>\n\n${finalContent ?? ""}`;
			}

			return {
				content: finalContent,
				tool_calls: choice.message.tool_calls as any,
				finish_reason: choice.finish_reason,
			};
		} catch (err: any) {
			const status = err.status ?? err.statusCode ?? "";
			const rawErrorMsg = err.error?.message ?? err.message ?? "Error desconocido";
			let friendlyMsg = rawErrorMsg;
			if (rawErrorMsg.includes("image input is not supported") || rawErrorMsg.includes("mmproj")) {
				friendlyMsg = `El modelo activo no soporta imágenes (mmproj no cargado). Para analizar imágenes, selecciona un modelo multimodal como "qwen3.5-4b" o "gemma-4-e4b" en la barra de modelos.`;
			} else if (status === 503 || rawErrorMsg.includes("Loading model")) {
				friendlyMsg = `El modelo se está cargando en memoria en el motor llama.cpp. Por favor aguarda unos segundos y reintenta tu mensaje.`;
			}
			throw new Error(friendlyMsg);
		}
	}

	async *sendMessageStream(
		messages: LLMMessage[],
		tools: ToolSpec[],
		model?: string,
		modelSettings?: ModelSettings,
	): AsyncGenerator<{ type: string; data: any }> {
		const useModel = model ?? this.model;
		const openaiTools =
			tools.length > 0
				? tools.map((t) => ({
						type: "function" as const,
						function: {
							name: t.function.name,
							description: t.function.description,
							parameters: t.function.parameters as unknown as Record<string, unknown>,
						},
					}))
				: undefined;

		try {
			const stream = await this.client.chat.completions.create({
				model: useModel,
				messages: messages as any,
				tools: openaiTools as any,
				tool_choice: tools.length > 0 ? "auto" : undefined,
				temperature: modelSettings?.temperature,
				top_p: modelSettings?.topP,
				max_tokens: modelSettings?.maxTokens,
				presence_penalty: modelSettings?.presencePenalty,
				frequency_penalty: modelSettings?.frequencyPenalty,
				stream: true,
			});

			let reasoningStarted = false;
			let reasoningEnded = false;

			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta as any;
				const reasoningChunk = delta?.reasoning_content ?? delta?.reasoning;

				if (reasoningChunk && modelSettings?.enableReasoning !== false) {
					if (!reasoningStarted) {
						reasoningStarted = true;
						yield { type: "content", data: "<think>\n" };
					}
					yield { type: "content", data: reasoningChunk };
				}

				if (delta?.content) {
					if (reasoningStarted && !reasoningEnded) {
						reasoningEnded = true;
						yield { type: "content", data: "\n</think>\n\n" };
					}
					yield { type: "content", data: delta.content };
				}

				if (delta?.tool_calls) {
					for (const tc of delta.tool_calls) {
						yield { type: "tool_call", data: tc };
					}
				}

				if (chunk.choices[0]?.finish_reason) {
					if (reasoningStarted && !reasoningEnded) {
						reasoningEnded = true;
						yield { type: "content", data: "\n</think>\n\n" };
					}
					yield { type: "finish", data: chunk.choices[0].finish_reason };
				}
			}
		} catch (err: any) {
			const status = err.status ?? err.statusCode ?? "";
			const rawErrorMsg = err.error?.message ?? err.message ?? "Error desconocido";
			let friendlyMsg = rawErrorMsg;
			if (rawErrorMsg.includes("image input is not supported") || rawErrorMsg.includes("mmproj")) {
				friendlyMsg = `El modelo activo no soporta imágenes (mmproj no cargado). Para analizar imágenes, selecciona un modelo multimodal como "qwen3.5-4b" o "gemma-4-e4b" en la barra de modelos.`;
			} else if (status === 503 || rawErrorMsg.includes("Loading model")) {
				friendlyMsg = `El modelo se está cargando en memoria en el motor llama.cpp. Por favor aguarda unos segundos y reintenta tu mensaje.`;
			}
			throw new Error(friendlyMsg);
		}
	}

	getModel(): string {
		return this.model;
	}

	getBaseURL(): string {
		return this.baseURL;
	}
}
