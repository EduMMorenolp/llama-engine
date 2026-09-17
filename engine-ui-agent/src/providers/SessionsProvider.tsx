import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import {
	createSession as apiCreateSession,
	deleteSession as apiDeleteSession,
	fetchSession,
	fetchSessions,
	type Message,
	type Session,
	updateSession as apiUpdateSession,
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
	renameSession: (id: string, newName: string) => Promise<void>;
	forkSession: (upToMessageId: string) => Promise<Session>;
	deleteMessage: (messageId: string) => void;
	addMessage: (msg: Message) => void;
	updateLastMessage: (content: string) => void;
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

const SessionsContext = createContext<SessionsContextType | null>(null);

export function SessionsProvider({ children }: { children: ReactNode }) {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
		try {
			return localStorage.getItem("active_session_id") || null;
		} catch {
			return null;
		}
	});
	const [messages, setMessages] = useState<Message[]>([]);
	const [loading, setLoading] = useState(false);

	const selectSession = useCallback(async (id: string) => {
		setActiveSessionId(id);
		try {
			localStorage.setItem("active_session_id", id);
		} catch {}
		try {
			const session = await fetchSession(id);
			setMessages(session?.messages ?? []);
		} catch (err) {
			console.error("[sessions] Error al cargar la sesión:", err);
			setMessages([]);
		}
	}, []);

	const loadSessions = useCallback(async () => {
		setLoading(true);
		try {
			const list = await fetchSessions();
			const validList = list ?? [];
			setSessions(validList);

			const savedId = (() => {
				try {
					return localStorage.getItem("active_session_id");
				} catch {
					return null;
				}
			})();

			const targetId =
				(activeSessionId && validList.some((s) => s.id === activeSessionId)
					? activeSessionId
					: null) ||
				(savedId && validList.some((s) => s.id === savedId) ? savedId : null) ||
				(validList.length > 0 ? validList[0].id : null);

			if (targetId) {
				setActiveSessionId(targetId);
				try {
					localStorage.setItem("active_session_id", targetId);
					const session = await fetchSession(targetId);
					setMessages(session?.messages ?? []);
				} catch (err) {
					console.error("[sessions] Error al cargar mensajes:", err);
				}
			}
		} catch (err) {
			console.warn("[sessions] Error al cargar sesiones:", err);
			setSessions([]);
		} finally {
			setLoading(false);
		}
	}, [activeSessionId]);

	useEffect(() => {
		loadSessions();
	}, []);

	const createNewSession = useCallback(async (name?: string, model?: string) => {
		try {
			const session = await apiCreateSession(name, model);
			setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
			setActiveSessionId(session.id);
			try {
				localStorage.setItem("active_session_id", session.id);
			} catch {}
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
			try {
				localStorage.setItem("active_session_id", fallbackSession.id);
			} catch {}
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
				const remaining = sessions.filter((s) => s.id !== id);
				const nextActive = remaining.length > 0 ? remaining[0].id : null;
				setActiveSessionId(nextActive);
				if (nextActive) {
					try {
						localStorage.setItem("active_session_id", nextActive);
					} catch {}
					fetchSession(nextActive).then((sess) => setMessages(sess?.messages ?? []));
				} else {
					try {
						localStorage.removeItem("active_session_id");
					} catch {}
					setMessages([]);
				}
			}
		},
		[activeSessionId, sessions],
	);

	const renameSession = useCallback(async (id: string, newName: string) => {
		const trimmed = newName.trim();
		if (!trimmed) return;
		// Optimistic update
		setSessions((prev) =>
			prev.map((s) => (s.id === id ? { ...s, name: trimmed, updatedAt: Date.now() } : s)),
		);
		try {
			await apiUpdateSession(id, { name: trimmed });
		} catch (err) {
			console.warn("[sessions] Error al actualizar nombre en backend:", err);
		}
	}, []);

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
				renameSession,
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
