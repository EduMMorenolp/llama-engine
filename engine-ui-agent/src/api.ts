import { apiDelete, apiGet, apiPost, connectWebSocket } from "./lib/api-client.ts";

export { connectWebSocket };

export interface Session {
	id: string;
	name: string | null;
	model: string | null;
	createdAt: number;
	updatedAt: number;
}

export interface Message {
	id: string;
	sessionId: string;
	role: "system" | "user" | "assistant" | "tool";
	content: string | null;
	toolCalls: string | null;
	toolCallId: string | null;
	createdAt: number;
}

export interface Tool {
	name: string;
	description: string;
	enabled: boolean;
}

export interface StreamEvent {
	type: "message" | "tool_start" | "tool_end" | "done" | "error";
	payload: Record<string, unknown>;
}

export async function fetchSessions(): Promise<Session[]> {
	const res = await apiGet<{ sessions: Session[] }>("/api/sessions");
	return res.sessions;
}

export async function createSession(name?: string, model?: string): Promise<Session> {
	return apiPost<Session>("/api/sessions", { name, model });
}

export async function fetchSession(id: string): Promise<Session & { messages: Message[] }> {
	return apiGet(`/api/sessions/${id}`);
}

export async function deleteSession(id: string): Promise<void> {
	await apiDelete(`/api/sessions/${id}`);
}

export async function fetchTools(): Promise<Tool[]> {
	const res = await apiGet<{ tools: Tool[] }>("/api/tools");
	return res.tools;
}

export interface HealthStatus {
	status: string;
	agentRunning: boolean;
}

export async function fetchHealth(): Promise<HealthStatus> {
	return apiGet<HealthStatus>("/api/health");
}
