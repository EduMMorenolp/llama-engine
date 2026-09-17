import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { fetchAvailableModels, type Message, type ModelInfo } from "../../../api.ts";
import {
	CheckIcon,
	ChevronDownIcon,
	FileCodeIcon,
	InfoIcon,
	PlusIcon,
	SearchIcon,
	SettingsIcon,
	SidebarIcon,
	SparklesIcon,
	TerminalIcon,
	XIcon,
} from "../../../components/ui/Icons.tsx";
import { useToast } from "../../../providers/ToastProvider.tsx";
import { useSessions } from "../../sessions/hooks/useSessions.ts";
import { useChat } from "../hooks/useChat.ts";
import { Composer } from "./Composer.tsx";
import type { FileAttachment } from "./FileUpload.tsx";
import { MessageBubble } from "./MessageBubble.tsx";
import { ModelInfoModal } from "./ModelInfoModal.tsx";
import { SettingsModal } from "./SettingsModal.tsx";

interface LayoutContextType {
	sidebarOpen: boolean;
	toggleSidebar: () => void;
}

const FALLBACK_MODELS: ModelInfo[] = [
	{
		id: "qwen3.5-9b",
		name: "Qwen 3.5 9B",
		desc: "Texto · 4.7 GB GGUF",
		badge: "Activo",
		loaded: true,
	},
	{
		id: "qwen3.5-4b",
		name: "Qwen 3.5 4B",
		desc: "Multimodal (visión) · 2.6 GB GGUF",
		badge: "Visión",
		vision: true,
	},
	{
		id: "gemma-4-e4b",
		name: "Gemma 4 E4B",
		desc: "Multimodal (visión) · 4.8 GB GGUF",
		badge: "Visión",
		vision: true,
	},
	{
		id: "mistral-small-7b",
		name: "Mistral Small 7B",
		desc: "Texto · 4.1 GB GGUF",
		badge: "Texto",
	},
	{
		id: "phi-4-mini",
		name: "Phi 4 Mini",
		desc: "Texto · 2.3 GB GGUF",
		badge: "Compacto",
	},
];

const STARTER_PROMPTS = [
	{
		icon: <FileCodeIcon size={18} />,
		title: "Analizar arquitectura",
		desc: "Revisar la estructura del proyecto y proponer mejoras modulares",
		prompt:
			"Analiza la arquitectura de este proyecto y sugiere mejoras de rendimiento, escalabilidad y patrones de diseño limpios.",
	},
	{
		icon: <TerminalIcon size={18} />,
		title: "Automatización & Bash",
		desc: "Generar scripts de desarrollo o pipelines locales",
		prompt:
			"Escribe un script automatizado para compilar, probar y verificar el estado del proyecto.",
	},
	{
		icon: <SearchIcon size={18} />,
		title: "Búsqueda & Depuración",
		desc: "Investigar errores y proponer soluciones robustas",
		prompt:
			"Ayúdame a diagnosticar posibles errores de concurrencia y optimizaciones de memoria en el sistema.",
	},
	{
		icon: <SparklesIcon size={18} />,
		title: "Diseño & Experiencia UX",
		desc: "Idear interfaces modernas y accesibles",
		prompt:
			"Diseña una interfaz moderna con micro-interacciones, tema oscuro y estética vanguardista.",
	},
];

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatView() {
	const { addToast } = useToast();
	const {
		sessions,
		activeSessionId,
		messages,
		addMessage,
		createNewSession,
		selectSession,
		removeSession,
		forkSession,
		deleteMessage,
		loading: sessionsLoading,
	} = useSessions();
	const { streaming, currentContent, toolCalls, connectionState, sendMessage, stopStreaming } =
		useChat();
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const modelMenuRef = useRef<HTMLDivElement>(null);
	const { sidebarOpen, toggleSidebar } = useOutletContext<LayoutContextType>() ?? {
		sidebarOpen: true,
		toggleSidebar: () => {},
	};

	const [models, setModels] = useState<ModelInfo[]>(FALLBACK_MODELS);
	const [selectedModel, setSelectedModel] = useState("qwen3.5-9b");
	const [showModelMenu, setShowModelMenu] = useState(false);
	const [selectedModelInfo, setSelectedModelInfo] = useState<ModelInfo | null>(null);
	const [showSettings, setShowSettings] = useState(false);

	// Load models from llama.cpp / engine-api
	useEffect(() => {
		fetchAvailableModels()
			.then((res) => {
				if (res?.models && res.models.length > 0) {
					setModels(res.models);
					if (res.activeModel) {
						setSelectedModel(res.activeModel);
					} else {
						const loaded = res.models.find((m) => m.loaded);
						if (loaded) setSelectedModel(loaded.id);
					}
				}
			})
			.catch(() => {
				// Keep fallback
			});
	}, []);

	// Close model menu when clicking outside
	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
				setShowModelMenu(false);
			}
		}
		if (showModelMenu) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [showModelMenu]);

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	useEffect(() => {
		if (messages.length > 0 || currentContent || toolCalls.length > 0) {
			scrollToBottom();
		}
	}, [scrollToBottom, messages, currentContent, toolCalls]);

	const handleSend = async (
		text: string,
		attachments: FileAttachment[],
		options?: { systemPrompt?: string; enabledTools?: string[] },
	) => {
		let sessionId = activeSessionId;
		if (!sessionId) {
			const session = await createNewSession(undefined, selectedModel);
			sessionId = session.id;
		}

		// If there are attachments, build full message for the LLM & UI
		let fullMessage = text.trim();
		if (attachments && attachments.length > 0) {
			const attachmentsParts = attachments.map((a) => {
				if (a.preview && a.preview.startsWith("data:image")) {
					return `![${a.name}](${a.preview})`;
				}
				if (a.content) {
					const ext = a.name.split(".").pop() || "";
					return `📎 **${a.name}** (${formatFileSize(a.size)})\n\`\`\`${ext}\n${a.content}\n\`\`\``;
				}
				return `📎 **${a.name}** (${formatFileSize(a.size)})`;
			});

			const attachmentsSummary = attachmentsParts.join("\n\n");
			fullMessage = fullMessage ? `${attachmentsSummary}\n\n${fullMessage}` : attachmentsSummary;
		}

		// Display full message with attachments in UI
		addMessage({
			id: crypto.randomUUID?.() ?? Date.now().toString(),
			sessionId,
			role: "user",
			content: fullMessage,
			toolCalls: null,
			toolCallId: null,
			createdAt: Date.now(),
		});

		sendMessage(
			sessionId,
			fullMessage,
			{
				model: selectedModel,
				systemPrompt: options?.systemPrompt,
				enabledTools: options?.enabledTools,
			},
			(msg) => addMessage(msg),
			() => {},
			(err) => {
				console.error("[chat] error:", err);
				addToast("error", err);
			},
		);
	};

	const handleFork = async (messageId: string) => {
		try {
			await forkSession(messageId);
			addToast("success", "Conversación bifurcada con éxito");
		} catch (err: unknown) {
			addToast("error", "Error al bifurcar conversación");
		}
	};

	const handleDeleteMsg = (messageId: string) => {
		deleteMessage(messageId);
		addToast("info", "Mensaje eliminado");
	};

	const handleReloadMsg = (msg: Message) => {
		if (msg.role === "user") {
			handleSend(msg.content ?? "", []);
		} else {
			// Find previous user message
			const idx = messages.findIndex((m) => m.id === msg.id);
			if (idx > 0) {
				const prevUserMsg = [...messages.slice(0, idx)].reverse().find((m) => m.role === "user");
				if (prevUserMsg) {
					handleSend(prevUserMsg.content ?? "", []);
				}
			}
		}
	};

	const handleStarterClick = (promptText: string) => {
		handleSend(promptText, []);
	};

	const activeModelObj = models.find((m) => m.id === selectedModel) || models[0];

	if (sessionsLoading) {
		return (
			<div className="view-loading">
				<div className="spinner" />
				<span>Iniciando sesión...</span>
			</div>
		);
	}

	return (
		<div className="main" style={{ width: "100%", height: "100%", position: "relative" }}>
			{/* Chat Top Navbar with Tabs & Controls */}
			<header className="chat-navbar">
				<div className="chat-navbar-left" ref={modelMenuRef} style={{ position: "relative" }}>
					{!sidebarOpen && (
						<button
							type="button"
							className="toggle-sidebar-btn"
							onClick={toggleSidebar}
							title="Mostrar barra lateral"
						>
							<SidebarIcon size={17} />
						</button>
					)}

					{/* Model Dropdown Button */}
					<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
						<button
							type="button"
							className="model-badge-selector"
							onClick={() => setShowModelMenu((prev) => !prev)}
							title="Seleccionar modelo de IA"
						>
							<span className="model-dot" />
							<span>{selectedModel}</span>
							<ChevronDownIcon
								size={14}
								style={{
									color: "var(--text-muted)",
									transform: showModelMenu ? "rotate(180deg)" : "none",
									transition: "transform 0.2s ease",
								}}
							/>
						</button>

						<button
							type="button"
							className="action-icon-btn"
							onClick={() => setSelectedModelInfo(activeModelObj)}
							title="Información del modelo activo"
						>
							<InfoIcon size={15} style={{ color: "var(--text-secondary)" }} />
						</button>
					</div>

					{/* Multi-chat Tabs */}
					<div className="chat-tabs-bar">
						{sessions.slice(0, 4).map((s) => (
							<div
								key={s.id}
								className={`chat-tab-chip ${s.id === activeSessionId ? "active" : ""}`}
								onClick={() => selectSession(s.id)}
							>
								<span>{s.name || `Chat ${s.id.slice(0, 6)}`}</span>
								<button
									type="button"
									className="chat-tab-close"
									onClick={(e) => {
										e.stopPropagation();
										removeSession(s.id);
									}}
									title="Cerrar pestaña"
								>
									<XIcon size={12} />
								</button>
							</div>
						))}
						<button
							type="button"
							className="chat-tab-chip new-tab"
							onClick={() => createNewSession()}
							title="Nueva pestaña"
						>
							<PlusIcon size={13} />
						</button>
					</div>

					{/* Model Dropdown Menu */}
					{showModelMenu && (
						<div className="popover-menu model-dropdown-popover">
							<div className="popover-header">
								<span>Modelos GGUF (llama.cpp)</span>
							</div>
							{models.map((m) => (
								<div
									key={m.id}
									className={`popover-item ${m.id === selectedModel ? "active-model-item" : ""}`}
									onClick={() => {
										setSelectedModel(m.id);
										setShowModelMenu(false);
									}}
								>
									<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
										<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
											<span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
												{m.name}
											</span>
											{m.badge && (
												<span
													className="model-tag-badge"
													style={{
														background: m.loaded ? "rgba(16, 185, 129, 0.2)" : undefined,
														color: m.loaded ? "#10b981" : undefined,
													}}
												>
													{m.badge}
												</span>
											)}
										</div>
										<span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{m.desc}</span>
									</div>
									<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
										<button
											type="button"
											className="session-action-btn"
											onClick={(e) => {
												e.stopPropagation();
												setShowModelMenu(false);
												setSelectedModelInfo(m);
											}}
											title={`Ver información de ${m.name}`}
										>
											<InfoIcon size={13} />
										</button>
										{m.id === selectedModel && (
											<CheckIcon size={15} style={{ color: "var(--accent)" }} />
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="chat-navbar-right">
					<div className="connection-pill">
						<div className={`connection-dot ${connectionState}`} />
						<span>
							{connectionState === "connected"
								? "Conectado"
								: connectionState === "reconnecting"
									? "Reconectando"
									: "Desconectado"}
						</span>
					</div>

					<button
						type="button"
						className="action-icon-btn"
						onClick={() => setShowSettings(true)}
						title="Configuración global"
					>
						<SettingsIcon size={16} />
					</button>
				</div>
			</header>

			{/* Message Stream */}
			<div className="messages-container">
				<div className="messages-inner">
					{messages.length === 0 && !streaming ? (
						<div className="empty-hero">
							<div className="hero-avatar-glow">
								<SparklesIcon size={32} />
							</div>
							<h1 className="hero-title">¿En qué puedo ayudarte hoy?</h1>
							<p className="hero-subtitle">
								Agente potenciado por LLM y herramientas avanzadas de ejecución de comandos,
								análisis de archivos y razonamiento en tiempo real.
							</p>

							<div className="starter-cards-grid">
								{STARTER_PROMPTS.map((starter) => (
									<button
										key={starter.title}
										type="button"
										className="starter-card"
										onClick={() => handleStarterClick(starter.prompt)}
									>
										<div className="starter-card-title">
											{starter.icon}
											<span>{starter.title}</span>
										</div>
										<div className="starter-card-desc">{starter.desc}</div>
									</button>
								))}
							</div>
						</div>
					) : (
						<>
							{messages.map((msg) => (
								<MessageBubble
									key={msg.id}
									message={msg}
									modelName={selectedModel}
									onFork={handleFork}
									onDelete={handleDeleteMsg}
									onReload={handleReloadMsg}
								/>
							))}

							{streaming && (currentContent || toolCalls.length > 0) && (
								<MessageBubble
									message={{
										id: "streaming",
										sessionId: activeSessionId ?? "",
										role: "assistant",
										content: currentContent,
										toolCalls: null,
										toolCallId: null,
										createdAt: Date.now(),
									}}
									toolCalls={toolCalls}
									modelName={selectedModel}
									isStreaming
								/>
							)}
						</>
					)}
					<div ref={messagesEndRef} />
				</div>
			</div>

			{/* Floating Input Composer */}
			<Composer
				onSend={handleSend}
				onStop={stopStreaming}
				disabled={streaming}
				model={selectedModel}
			/>

			{/* Model Information Modal */}
			{selectedModelInfo && (
				<ModelInfoModal
					model={selectedModelInfo}
					onClose={() => setSelectedModelInfo(null)}
				/>
			)}

			{/* Settings Modal */}
			{showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
		</div>
	);
}
