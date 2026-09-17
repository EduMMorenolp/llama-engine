import { useCallback, useEffect, useRef, useState } from "react";
import { connectWebSocket, fetchHealth, type Message, type StreamEvent } from "../../../api.ts";
import { randomUUID } from "../../../utils.ts";
import type { ModelSettings } from "../components/ModelSettingsModal.tsx";

export interface ToolCallInfo {
	id: string;
	name: string;
	args: Record<string, unknown>;
	result?: string;
	status: "pending" | "done" | "error";
}

export interface SendMessageOptions {
	model?: string;
	systemPrompt?: string;
	enabledTools?: string[];
	modelSettings?: ModelSettings;
}

interface UseChatReturn {
	streaming: boolean;
	currentContent: string;
	toolCalls: ToolCallInfo[];
	connectionState: "connected" | "reconnecting" | "disconnected";
	sendMessage: (
		sessionId: string,
		message: string,
		options: SendMessageOptions | undefined,
		onMessage: (msg: Message) => void,
		onDone: () => void,
		onError: (msg: string) => void,
	) => void;
	stopStreaming: () => void;
	checkHealth: () => Promise<boolean>;
}

export function useChat(): UseChatReturn {
	const [streaming, setStreaming] = useState(false);
	const [currentContent, setCurrentContent] = useState("");
	const [toolCalls, setToolCalls] = useState<ToolCallInfo[]>([]);
	const [connectionState, setConnectionState] = useState<
		"connected" | "reconnecting" | "disconnected"
	>("disconnected");
	const wsRef = useRef<WebSocket | null>(null);

	const checkHealth = useCallback(async (): Promise<boolean> => {
		try {
			const res = await fetchHealth();
			if (res?.status === "ok" || res?.agentRunning !== undefined) {
				setConnectionState("connected");
				return true;
			}
			setConnectionState("disconnected");
			return false;
		} catch {
			setConnectionState("disconnected");
			return false;
		}
	}, []);

	// Initial health check and periodic ping
	useEffect(() => {
		checkHealth();
		const interval = setInterval(() => {
			if (!streaming) {
				checkHealth();
			}
		}, 15000);
		return () => clearInterval(interval);
	}, [checkHealth, streaming]);

	const sendMessage = useCallback(
		(
			sessionId: string,
			message: string,
			options: SendMessageOptions | undefined,
			onMessage: (msg: Message) => void,
			onDone: () => void,
			onError: (msg: string) => void,
		) => {
			if (streaming) return;
			setStreaming(true);
			setCurrentContent("");
			setToolCalls([]);

			let ws: WebSocket;
			try {
				ws = connectWebSocket();
				wsRef.current = ws;
			} catch (err) {
				setConnectionState("disconnected");
				setStreaming(false);
				onError(err instanceof Error ? err.message : "Error al conectar WebSocket");
				return;
			}

			let assistantContent = "";
			const activeToolCalls: ToolCallInfo[] = [];

			ws.onopen = () => {
				setConnectionState("connected");
				ws.send(
					JSON.stringify({
						type: "chat",
						payload: {
							sessionId,
							message,
							model: options?.model,
							systemPrompt: options?.systemPrompt,
							enabledTools: options?.enabledTools,
							modelSettings: options?.modelSettings,
						},
					}),
				);
			};

			ws.onmessage = (event) => {
				try {
					const data: StreamEvent = JSON.parse(event.data);

					switch (data.type) {
						case "message": {
							const content = (data.payload.content as string) ?? "";
							assistantContent += content;
							setCurrentContent(assistantContent);
							break;
						}
						case "tool_start": {
							const callId =
								(data.payload.id as string) ||
								`${data.payload.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
							const tc: ToolCallInfo = {
								id: callId,
								name: (data.payload.name as string) ?? "tool",
								args: (data.payload.args as Record<string, unknown>) ?? {},
								status: "pending",
							};
							activeToolCalls.push(tc);
							setToolCalls([...activeToolCalls]);
							break;
						}
						case "tool_end": {
							const callId = data.payload.id as string | undefined;
							const name = data.payload.name as string;
							const result = (data.payload.result as string) ?? "";
							const existing = callId
								? activeToolCalls.find((t) => t.id === callId)
								: activeToolCalls.find((t) => t.name === name && t.status === "pending");
							if (existing) {
								existing.result = result;
								existing.status = data.payload.error ? "error" : "done";
							}
							setToolCalls([...activeToolCalls]);
							break;
						}
						case "done": {
							if (assistantContent) {
								onMessage({
									id: randomUUID(),
									sessionId,
									role: "assistant",
									content: assistantContent,
									toolCalls: activeToolCalls.length > 0 ? JSON.stringify(activeToolCalls) : null,
									toolCallId: null,
									createdAt: Date.now(),
								});
							}
							setStreaming(false);
							setCurrentContent("");
							setToolCalls([]);
							onDone();
							ws.close();
							break;
						}
						case "error": {
							const errorMsg =
								(data.payload?.message as string) ?? "Error desconocido en el agente";
							onMessage({
								id: randomUUID(),
								sessionId,
								role: "assistant",
								content: `⚠️ **Aviso**: ${errorMsg}`,
								toolCalls: null,
								toolCallId: null,
								createdAt: Date.now(),
							});
							onError(errorMsg);
							setStreaming(false);
							setCurrentContent("");
							setToolCalls([]);
							ws.close();
							break;
						}
					}
				} catch (err) {
					console.error("[ws] Error parsing message:", err);
				}
			};

			ws.onerror = () => {
				setConnectionState("disconnected");
				const errorMsg = "Error de conexión WebSocket con el servidor del agente";
				onMessage({
					id: randomUUID(),
					sessionId,
					role: "assistant",
					content: `⚠️ **Aviso**: ${errorMsg}`,
					toolCalls: null,
					toolCallId: null,
					createdAt: Date.now(),
				});
				onError(errorMsg);
				setStreaming(false);
				setCurrentContent("");
				setToolCalls([]);
			};

			ws.onclose = () => {
				if (streaming) {
					setStreaming(false);
				}
			};
		},
		[streaming],
	);

	const stopStreaming = useCallback(() => {
		if (wsRef.current) {
			wsRef.current.close();
			wsRef.current = null;
		}
		setStreaming(false);
		setCurrentContent("");
		setToolCalls([]);
	}, []);

	return {
		streaming,
		currentContent,
		toolCalls,
		connectionState,
		sendMessage,
		stopStreaming,
		checkHealth,
	};
}
