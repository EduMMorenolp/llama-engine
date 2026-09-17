import { apiDelete, apiGet, apiPatch, apiPost, connectWebSocket } from "./lib/api-client.ts";

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

export async function updateSession(
	id: string,
	data: { name?: string; model?: string },
): Promise<Session> {
	return apiPatch<Session>(`/api/sessions/${id}`, data);
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

export interface MCPServer {
	id: string;
	name: string;
	transport: "stdio" | "sse" | "http";
	command?: string;
	args?: string[];
	url?: string;
	status: "connected" | "disconnected" | "error";
	toolsCount?: number;
	errorMessage?: string;
}

export async function fetchMCPServers(): Promise<MCPServer[]> {
	const res = await apiGet<{ servers: MCPServer[] }>("/api/mcp/servers");
	return res.servers;
}

export async function addMCPServer(server: Partial<MCPServer>): Promise<MCPServer> {
	return apiPost<MCPServer>("/api/mcp/servers", server);
}

export async function deleteMCPServer(id: string): Promise<void> {
	await apiDelete(`/api/mcp/servers/${id}`);
}

export async function connectMCPServer(
	id: string,
): Promise<{ success: boolean; tools: string[]; error?: string }> {
	return apiPost(`/api/mcp/servers/${id}/connect`, {});
}

export async function disconnectMCPServer(id: string): Promise<{ success: boolean }> {
	return apiPost(`/api/mcp/servers/${id}/disconnect`, {});
}

export interface ModelInfo {
	id: string;
	name: string;
	size?: string;
	vision?: boolean;
	loaded?: boolean;
	badge?: string;
	desc?: string;
}

export async function fetchAvailableModels(): Promise<{ models: ModelInfo[]; activeModel?: string }> {
	return apiGet<{ models: ModelInfo[]; activeModel?: string }>("/api/models");
}
