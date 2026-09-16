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

export interface Memory {
	id: string;
	key: string;
	content: string;
	tags: string[];
	createdAt: number;
	updatedAt: number;
}

export interface CustomToolRow {
	name: string;
	description: string;
	parameters: string;
	handlerType: string;
	handlerConfig: string;
	enabled: number;
	createdAt: number;
}
