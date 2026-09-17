import { useState } from "react";
import { createPortal } from "react-dom";
import {
	BoxIcon,
	DownloadIcon,
	GlobeIcon,
	SettingsIcon,
	SlidersIcon,
	SparklesIcon,
	TerminalIcon,
	TrashIcon,
	UploadIcon,
	WrenchIcon,
	XIcon,
} from "../../../components/ui/Icons.tsx";
import { useToast } from "../../../providers/ToastProvider.tsx";
import { useSessions } from "../../sessions/hooks/useSessions.ts";

interface SettingsModalProps {
	onClose: () => void;
}

type TabType =
	| "general"
	| "display"
	| "tools"
	| "agentic"
	| "import_export"
	| "sampling"
	| "developer";

export function SettingsModal({ onClose }: SettingsModalProps) {
	const { addToast } = useToast();
	const { sessions, removeSession, loadSessions } = useSessions();
	const [activeTab, setActiveTab] = useState<TabType>("import_export");

	// General settings state
	const [autoScroll, setAutoScroll] = useState(true);
	const [streamResponses, setStreamResponses] = useState(true);
	const [showMetrics, setShowMetrics] = useState(true);
	const [expandReasoning, setExpandReasoning] = useState(true);

	// Sampling state
	const [temperature, setTemperature] = useState(0.7);
	const [topP, setTopP] = useState(0.9);
	const [topK, setTopK] = useState(40);
	const [repeatPenalty, setRepeatPenalty] = useState(1.1);

	// Developer state
	const [apiUrl, setApiUrl] = useState("http://localhost:3060");
	const [engineUrl, setEngineUrl] = useState("http://localhost:3050");
	const [debugLogs, setDebugLogs] = useState(false);

	const handleSave = () => {
		localStorage.setItem(
			"llama_engine_settings",
			JSON.stringify({
				autoScroll,
				streamResponses,
				showMetrics,
				expandReasoning,
				temperature,
				topP,
				topK,
				repeatPenalty,
				apiUrl,
				engineUrl,
				debugLogs,
			}),
		);
		addToast("success", "Configuración guardada correctamente");
		onClose();
	};

	const handleReset = () => {
		setAutoScroll(true);
		setStreamResponses(true);
		setShowMetrics(true);
		setExpandReasoning(true);
		setTemperature(0.7);
		setTopP(0.9);
		setTopK(40);
		setRepeatPenalty(1.1);
		setApiUrl("http://localhost:3060");
		setEngineUrl("http://localhost:3050");
		setDebugLogs(false);
		localStorage.removeItem("llama_engine_settings");
		addToast("info", "Valores restaurados por defecto");
	};

	// Export conversations to JSONL file
	const handleExportConversations = () => {
		try {
			const exportData = JSON.stringify(sessions, null, 2);
			const blob = new Blob([exportData], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `llama-engine-conversations-${new Date().toISOString().slice(0, 10)}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			addToast("success", "Conversaciones exportadas exitosamente");
		} catch (err: unknown) {
			addToast("error", "Error al exportar conversaciones");
		}
	};

	// Import conversations
	const handleImportConversations = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const content = reader.result as string;
				const imported = JSON.parse(content);
				if (Array.isArray(imported)) {
					addToast("success", `${imported.length} conversaciones importadas`);
					loadSessions();
				} else {
					addToast("error", "Formato de archivo inválido");
				}
			} catch {
				addToast("error", "Error al leer el archivo JSON");
			}
		};
		reader.readAsText(file);
		e.target.value = "";
	};

	// Delete all conversations
	const handleDeleteAll = async () => {
		if (
			window.confirm(
				"¿Estás seguro de eliminar todas las conversaciones? Esta acción es permanente y no se puede deshacer.",
			)
		) {
			for (const s of sessions) {
				await removeSession(s.id);
			}
			addToast("info", "Todas las conversaciones han sido eliminadas");
			loadSessions();
		}
	};

	const navItems: { id: TabType; label: string; icon: React.ReactNode }[] = [
		{ id: "general", label: "General", icon: <SettingsIcon size={16} /> },
		{ id: "display", label: "Display", icon: <GlobeIcon size={16} /> },
		{ id: "tools", label: "Tools", icon: <WrenchIcon size={16} /> },
		{ id: "agentic", label: "Agentic", icon: <SparklesIcon size={16} /> },
		{ id: "import_export", label: "Import/Export", icon: <BoxIcon size={16} /> },
		{ id: "sampling", label: "Sampling & Penalties", icon: <SlidersIcon size={16} /> },
		{ id: "developer", label: "Developer", icon: <TerminalIcon size={16} /> },
	];

	return createPortal(
		<div className="dialog-backdrop">
			<button
				type="button"
				className="dialog-backdrop-btn"
				onClick={onClose}
				aria-label="Cerrar modal"
			/>
			<div
				className="dialog-card settings-dialog"
				style={{
					zIndex: 1,
					position: "relative",
					maxWidth: "760px",
					width: "90vw",
					height: "560px",
					padding: 0,
					display: "flex",
					flexDirection: "row",
					overflow: "hidden",
				}}
			>
				{/* Settings Sidebar Nav */}
				<div className="settings-sidebar">
					<div className="settings-sidebar-header">
						<SettingsIcon size={18} style={{ color: "var(--accent)" }} />
						<span>Settings</span>
					</div>
					<div className="settings-nav-list">
						{navItems.map((item) => (
							<button
								key={item.id}
								type="button"
								className={`settings-nav-item ${activeTab === item.id ? "active" : ""}`}
								onClick={() => setActiveTab(item.id)}
							>
								<span className="settings-nav-icon">{item.icon}</span>
								<span>{item.label}</span>
							</button>
						))}
					</div>
				</div>

				{/* Settings Content Area */}
				<div className="settings-content-area">
					<div className="settings-content-header">
						<span style={{ fontWeight: 600, fontSize: "16px" }}>
							{navItems.find((n) => n.id === activeTab)?.label}
						</span>
						<button
							type="button"
							className="session-action-btn"
							onClick={onClose}
							title="Cerrar modal"
							style={{ opacity: 1 }}
						>
							<XIcon size={18} />
						</button>
					</div>

					<div className="settings-content-body">
						{activeTab === "import_export" && (
							<div className="settings-section-container">
								<div className="settings-group">
									<div className="settings-group-title">Conversations</div>

									<div className="settings-row">
										<div>
											<div className="settings-item-title">Export</div>
											<div className="settings-item-desc">
												Download your conversations as a JSON file. This includes all messages,
												attachments, and conversation history.
											</div>
										</div>
										<button
											type="button"
											className="settings-action-btn"
											onClick={handleExportConversations}
										>
											<DownloadIcon size={15} />
											<span>Export conversations</span>
										</button>
									</div>

									<div className="settings-row">
										<div>
											<div className="settings-item-title">Import</div>
											<div className="settings-item-desc">
												Import one or more conversations from a previously exported JSON file. This
												will merge with your existing conversations.
											</div>
										</div>
										<label className="settings-action-btn" style={{ cursor: "pointer" }}>
											<UploadIcon size={15} />
											<span>Import conversations</span>
											<input
												type="file"
												accept=".json,.jsonl"
												onChange={handleImportConversations}
												style={{ display: "none" }}
											/>
										</label>
									</div>

									<div className="settings-row danger-row">
										<div>
											<div className="settings-item-title" style={{ color: "var(--danger)" }}>
												Delete All
											</div>
											<div className="settings-item-desc">
												Permanently delete all conversations and their messages. This action cannot be
												undone. Consider exporting your conversations first if you want to keep a
												backup.
											</div>
										</div>
										<button
											type="button"
											className="settings-danger-btn"
											onClick={handleDeleteAll}
										>
											<TrashIcon size={15} />
											<span>Delete all conversations</span>
										</button>
									</div>
								</div>
							</div>
						)}

						{activeTab === "general" && (
							<div className="settings-section-container">
								<div className="settings-group">
									<div className="settings-group-title">General Preferences</div>
									<div className="settings-toggle-row">
										<div>
											<div className="settings-item-title">Auto-scroll to latest message</div>
											<div className="settings-item-desc">
												Automatically scroll down as new tokens and tool logs are generated.
											</div>
										</div>
										<input
											type="checkbox"
											checked={autoScroll}
											onChange={(e) => setAutoScroll(e.target.checked)}
											className="toggle-checkbox"
										/>
									</div>
									<div className="settings-toggle-row">
										<div>
											<div className="settings-item-title">Stream responses in real-time</div>
											<div className="settings-item-desc">
												Render markdown progressively over WebSocket connection.
											</div>
										</div>
										<input
											type="checkbox"
											checked={streamResponses}
											onChange={(e) => setStreamResponses(e.target.checked)}
											className="toggle-checkbox"
										/>
									</div>
								</div>
							</div>
						)}

						{activeTab === "display" && (
							<div className="settings-section-container">
								<div className="settings-group">
									<div className="settings-group-title">Display & Performance</div>
									<div className="settings-toggle-row">
										<div>
											<div className="settings-item-title">Show token metrics & speed</div>
											<div className="settings-item-desc">
												Display token counts, inference duration (seconds), and generation speed
												(tokens/s).
											</div>
										</div>
										<input
											type="checkbox"
											checked={showMetrics}
											onChange={(e) => setShowMetrics(e.target.checked)}
											className="toggle-checkbox"
										/>
									</div>
									<div className="settings-toggle-row">
										<div>
											<div className="settings-item-title">Expand Reasoning by default</div>
											<div className="settings-item-desc">
												Keep model thinking process container open upon receiving messages.
											</div>
										</div>
										<input
											type="checkbox"
											checked={expandReasoning}
											onChange={(e) => setExpandReasoning(e.target.checked)}
											className="toggle-checkbox"
										/>
									</div>
								</div>
							</div>
						)}

						{activeTab === "sampling" && (
							<div className="settings-section-container">
								<div className="settings-group">
									<div className="settings-group-title">Inference Parameters</div>
									<div className="settings-slider-row">
										<div style={{ display: "flex", justifyContent: "space-between" }}>
											<span className="settings-item-title">Temperature</span>
											<span className="settings-slider-val">{temperature}</span>
										</div>
										<input
											type="range"
											min="0"
											max="2"
											step="0.05"
											value={temperature}
											onChange={(e) => setTemperature(parseFloat(e.target.value))}
										/>
									</div>

									<div className="settings-slider-row">
										<div style={{ display: "flex", justifyContent: "space-between" }}>
											<span className="settings-item-title">Top-P</span>
											<span className="settings-slider-val">{topP}</span>
										</div>
										<input
											type="range"
											min="0"
											max="1"
											step="0.05"
											value={topP}
											onChange={(e) => setTopP(parseFloat(e.target.value))}
										/>
									</div>

									<div className="settings-slider-row">
										<div style={{ display: "flex", justifyContent: "space-between" }}>
											<span className="settings-item-title">Repeat Penalty</span>
											<span className="settings-slider-val">{repeatPenalty}</span>
										</div>
										<input
											type="range"
											min="1"
											max="2"
											step="0.05"
											value={repeatPenalty}
											onChange={(e) => setRepeatPenalty(parseFloat(e.target.value))}
										/>
									</div>
								</div>
							</div>
						)}

						{activeTab === "developer" && (
							<div className="settings-section-container">
								<div className="settings-group">
									<div className="settings-group-title">Endpoints & Debug</div>
									<div className="settings-input-block">
										<span className="settings-item-title">Agent Service URL</span>
										<input
											type="text"
											className="sidebar-search-input"
											value={apiUrl}
											onChange={(e) => setApiUrl(e.target.value)}
										/>
									</div>
									<div className="settings-input-block">
										<span className="settings-item-title">Llama Engine API URL</span>
										<input
											type="text"
											className="sidebar-search-input"
											value={engineUrl}
											onChange={(e) => setEngineUrl(e.target.value)}
										/>
									</div>
								</div>
							</div>
						)}

						{(activeTab === "tools" || activeTab === "agentic") && (
							<div className="settings-section-container">
								<div className="settings-group">
									<div className="settings-group-title">Agent Engine Settings</div>
									<div className="settings-item-desc" style={{ marginBottom: "12px" }}>
										Configura la autonomía, memoria vectorial SQLite y ejecución de herramientas
										locales.
									</div>
									<div className="settings-toggle-row">
										<div>
											<div className="settings-item-title">Herramientas Autónomas Habilitadas</div>
											<div className="settings-item-desc">
												Permitir al agente ejecutar lecturas, búsquedas de código y memoria.
											</div>
										</div>
										<input type="checkbox" defaultChecked className="toggle-checkbox" />
									</div>
								</div>
							</div>
						)}
					</div>

					<div className="settings-content-footer">
						<button type="button" className="btn-secondary" onClick={handleReset}>
							Reset to default
						</button>
						<button type="button" className="btn-primary" onClick={handleSave}>
							Save settings
						</button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}

