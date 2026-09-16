import { useCallback, useState } from "react";
import {
	createSession as apiCreateSession,
	deleteSession as apiDeleteSession,
	fetchSession,
	fetchSessions,
	type Message,
	type Session,
} from "../../../api.ts";

export function useSessions() {
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

	return {
		sessions,
		activeSessionId,
		messages,
		loading,
		loadSessions,
		selectSession,
		createNewSession,
		removeSession,
		addMessage,
		updateLastMessage,
		setMessages,
	};
}
