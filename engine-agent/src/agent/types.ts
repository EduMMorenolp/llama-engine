export interface AgentOptions {
	sessionId: string;
	message: string;
	model?: string;
	workDir?: string;
	systemPrompt?: string;
	maxIterations?: number;
}

export interface AgentResult {
	content: string;
	toolCalls: ToolCallResult[];
	iterations: number;
}

export interface ToolCallResult {
	name: string;
	args: Record<string, unknown>;
	result: string;
}

export interface StreamEvent {
	type: "message" | "tool_start" | "tool_end" | "done" | "error";
	payload: Record<string, unknown>;
}

export interface LLMMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string | null;
	tool_calls?: LLMToolCall[];
	tool_call_id?: string;
}

export interface LLMToolCall {
	id: string;
	type: "function";
	function: {
		name: string;
		arguments: string;
	};
}

export interface LLMResponse {
	content: string | null;
	tool_calls?: LLMToolCall[];
	finish_reason: string | null;
}
