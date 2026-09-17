import { useEffect, useMemo, useState } from "react";
import {
	MessageSquareIcon,
	PlusIcon,
	SearchIcon,
	SettingsIcon,
	SidebarIcon,
	SparklesIcon,
	TrashIcon,
} from "../../../components/ui/Icons.tsx";
import { SettingsModal } from "../../chat/components/SettingsModal.tsx";
import { useSessions } from "../hooks/useSessions.ts";

interface SessionListProps {
	onToggleSidebar?: () => void;
	isSidebarOpen?: boolean;
}

export function SessionList({ onToggleSidebar }: SessionListProps) {
	const {
		sessions,
		activeSessionId,
		loadSessions,
		createNewSession,
		selectSession,
		removeSession,
	} = useSessions();

	const [searchQuery, setSearchQuery] = useState("");
	const [showSettings, setShowSettings] = useState(false);

	useEffect(() => {
		loadSessions();
	}, [loadSessions]);

	// Keyboard shortcut for New Chat (Ctrl+K or Alt+N)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				createNewSession();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [createNewSession]);

	const filteredSessions = useMemo(() => {
		if (!searchQuery.trim()) return sessions;
		const query = searchQuery.toLowerCase();
		return sessions.filter((s) => (s.name ?? s.id).toLowerCase().includes(query));
	}, [sessions, searchQuery]);

	return (
		<div className="sidebar-content">
			<div className="sidebar-header">
				<div className="sidebar-brand">
					<div className="sidebar-brand-icon">
						<SparklesIcon size={18} />
					</div>
					<div className="sidebar-brand-text">
						<span className="sidebar-brand-name">Llama Engine</span>
						<span className="sidebar-brand-badge">Agent Studio</span>
					</div>
				</div>
				{onToggleSidebar && (
					<button
						type="button"
						className="session-action-btn"
						onClick={onToggleSidebar}
						title="Ocultar barra lateral"
						style={{ opacity: 1, padding: "6px" }}
					>
						<SidebarIcon size={16} />
					</button>
				)}
			</div>

			<div className="sidebar-actions">
				<button
					type="button"
					className="new-chat-btn"
					onClick={() => createNewSession()}
					title="Iniciar nueva conversación"
				>
					<div className="new-chat-btn-left">
						<PlusIcon size={16} />
						<span>Nueva conversación</span>
					</div>
					<span className="new-chat-shortcut">Ctrl K</span>
				</button>

				<div className="sidebar-search-wrapper">
					<span className="sidebar-search-icon">
						<SearchIcon size={14} />
					</span>
					<input
						type="text"
						className="sidebar-search-input"
						placeholder="Buscar en el historial..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
			</div>

			<div className="sidebar-sessions-container">
				<div className="sidebar-section-title">Conversaciones Recientes</div>

				{filteredSessions.length === 0 ? (
					<div className="sidebar-empty">
						{searchQuery ? "No se encontraron coincidencias" : "Sin conversaciones aún"}
					</div>
				) : (
					filteredSessions.map((session) => (
						<div
							key={session.id}
							className={`session-item ${session.id === activeSessionId ? "active" : ""}`}
						>
							<button
								type="button"
								className="session-item-main"
								onClick={() => selectSession(session.id)}
								style={{
									background: "none",
									border: "none",
									color: "inherit",
									cursor: "pointer",
									textAlign: "left",
									width: "100%",
									padding: 0,
								}}
							>
								<span className="session-item-icon">
									<MessageSquareIcon size={15} />
								</span>
								<span className="session-name">
									{session.name || `Chat ${session.id.slice(0, 6)}`}
								</span>
							</button>

							<div className="session-item-actions">
								<button
									type="button"
									className="session-action-btn"
									title="Eliminar conversación"
									onClick={(e) => {
										e.stopPropagation();
										removeSession(session.id);
									}}
								>
									<TrashIcon size={14} />
								</button>
							</div>
						</div>
					))
				)}
			</div>

			<div className="sidebar-footer">
				<div className="sidebar-footer-status">
					<div className="connection-dot connected" />
					<span>Engine v0.1.0</span>
				</div>
				<button
					type="button"
					className="session-action-btn"
					onClick={() => setShowSettings(true)}
					title="Configuración"
					style={{ opacity: 1, padding: "6px" }}
				>
					<SettingsIcon size={16} />
				</button>
			</div>

			{showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
		</div>
	);
}
