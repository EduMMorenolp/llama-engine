import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import {
	createSession as apiCreateSession,
	deleteSession as apiDeleteSession,
	fetchSession,
	fetchSessions,
	type Message,
	type Session,
} from "../api.ts";

interface SessionsContextType {
	sessions: Session[];
	activeSessionId: string | null;
	messages: Message[];
	loading: boolean;
	loadSessions: () => Promise<void>;
	selectSession: (id: string) => Promise<void>;
	createNewSession: (name?: string, model?: string) => Promise<Session>;
	removeSession: (id: string) => Promise<void>;
	forkSession: (upToMessageId: string) => Promise<Session>;
	deleteMessage: (messageId: string) => void;
	addMessage: (msg: Message) => void;
	updateLastMessage: (content: string) => void;
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

const SessionsContext = createContext<SessionsContextType | null>(null);

export function SessionsProvider({ children }: { children: ReactNode }) {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [loading, setLoading] = useState(false);

	const loadSessions = useCallback(async () => {
		setLoading(true);
		try {
			const list = await fetchSessions();
			setSessions(list ?? []);
		} catch (err) {
			console.warn("[sessions] Error al cargar sesiones:", err);
			setSessions([]);
		} finally {
			setLoading(false);
		}
	}, []);

	const selectSession = useCallback(async (id: string) => {
		setActiveSessionId(id);
		try {
			const session = await fetchSession(id);
			setMessages(session?.messages ?? []);
		} catch (err) {
			console.error("[sessions] Error al cargar la sesión:", err);
			setMessages([]);
		}
	}, []);

	const createNewSession = useCallback(async (name?: string, model?: string) => {
		try {
			const session = await apiCreateSession(name, model);
			setSessions((prev) => [session, ...prev]);
			setActiveSessionId(session.id);
			setMessages([]);
			return session;
		} catch (err) {
			console.warn("[sessions] Backend no disponible, creando sesión local:", err);
			const fallbackSession: Session = {
				id: crypto.randomUUID?.() ?? Date.now().toString(),
				name: name ?? null,
				model: model ?? null,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};
			setSessions((prev) => [fallbackSession, ...prev]);
			setActiveSessionId(fallbackSession.id);
			setMessages([]);
			return fallbackSession;
		}
	}, []);

	const removeSession = useCallback(
		async (id: string) => {
			try {
				await apiDeleteSession(id);
			} catch (err) {
				console.warn("[sessions] Error al eliminar en backend:", err);
			}
			setSessions((prev) => prev.filter((s) => s.id !== id));
			if (activeSessionId === id) {
				setActiveSessionId(null);
				setMessages([]);
			}
		},
		[activeSessionId],
	);

	const forkSession = useCallback(
		async (upToMessageId: string) => {
			const active = sessions.find((s) => s.id === activeSessionId);
			const idx = messages.findIndex((m) => m.id === upToMessageId);
			const copiedMessages = idx >= 0 ? messages.slice(0, idx + 1) : messages;
			const newName = active?.name ? `${active.name} (Fork)` : "Chat Fork";
			const forkedSession = await createNewSession(newName, active?.model ?? undefined);
			setMessages(copiedMessages.map((m) => ({ ...m, sessionId: forkedSession.id })));
			return forkedSession;
		},
		[activeSessionId, messages, sessions, createNewSession],
	);

	const deleteMessage = useCallback((messageId: string) => {
		setMessages((prev) => prev.filter((m) => m.id !== messageId));
	}, []);

	const addMessage = useCallback((msg: Message) => {
		setMessages((prev) => [...prev, msg]);
	}, []);

	const updateLastMessage = useCallback((content: string) => {
		setMessages((prev) => {
			const last = prev[prev.length - 1];
			if (last && last.role === "assistant") {
				return [...prev.slice(0, -1), { ...last, content }];
			}
			return prev;
		});
	}, []);

	return (
		<SessionsContext.Provider
			value={{
				sessions,
				activeSessionId,
				messages,
				loading,
				loadSessions,
				selectSession,
				createNewSession,
				removeSession,
				forkSession,
				deleteMessage,
				addMessage,
				updateLastMessage,
				setMessages,
			}}
		>
			{children}
		</SessionsContext.Provider>
	);
}

export function useSessions() {
	const context = useContext(SessionsContext);
	if (!context) {
		throw new Error("useSessions debe ser utilizado dentro de un SessionsProvider");
	}
	return context;
}
