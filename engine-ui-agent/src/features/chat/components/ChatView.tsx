import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
	CheckIcon,
	ChevronDownIcon,
	FileCodeIcon,
	SearchIcon,
	SidebarIcon,
	SparklesIcon,
	TerminalIcon,
} from "../../../components/ui/Icons.tsx";
import { useToast } from "../../../providers/ToastProvider.tsx";
import { useSessions } from "../../sessions/hooks/useSessions.ts";
import { useChat } from "../hooks/useChat.ts";
import { Composer } from "./Composer.tsx";
import type { FileAttachment } from "./FileUpload.tsx";
import { MessageBubble } from "./MessageBubble.tsx";

interface LayoutContextType {
	sidebarOpen: boolean;
	toggleSidebar: () => void;
}

const AVAILABLE_MODELS = [
	{
		id: "qwen3.5-agent",
		name: "Qwen 2.5 Agent",
		desc: "Optimizado para herramientas y código",
		badge: "Default",
	},
	{
		id: "llama3.3-70b",
		name: "Llama 3.3 70B",
		desc: "Razonamiento profundo y conocimiento general",
		badge: "Meta",
	},
	{
		id: "deepseek-r1",
		name: "DeepSeek R1",
		desc: "Pensamiento explícito y matemáticas/lógica",
		badge: "Reasoning",
	},
	{
		id: "claude-3.5",
		name: "Claude 3.5 Sonnet",
		desc: "Alta precisión en desarrollo y análisis",
		badge: "Anthropic",
	},
	{
		id: "gpt-4o",
		name: "GPT-4o",
		desc: "Modelo multimodal insignia",
		badge: "OpenAI",
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
		activeSessionId,
		messages,
		addMessage,
		createNewSession,
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

	const [selectedModel, setSelectedModel] = useState("qwen3.5-agent");
	const [showModelMenu, setShowModelMenu] = useState(false);

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

		// If there are attachments, build full message for the LLM
		let fullMessage = text;
		if (attachments && attachments.length > 0) {
			const attachmentsSummary = attachments
				.map((a) => {
					if (a.content) {
						return `[Archivo adjunto: ${a.name} (${formatFileSize(a.size)})]\n\`\`\`\n${a.content}\n\`\`\``;
					}
					return `[Archivo adjunto: ${a.name} (${formatFileSize(a.size)})]`;
				})
				.join("\n\n");

			fullMessage = fullMessage ? `${fullMessage}\n\n${attachmentsSummary}` : attachmentsSummary;
		}

		// Display message in UI
		const displayContent = text || attachments.map((a) => `📎 ${a.name}`).join(", ");
		addMessage({
			id: crypto.randomUUID?.() ?? Date.now().toString(),
			sessionId,
			role: "user",
			content: displayContent,
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

	const handleStarterClick = (promptText: string) => {
		handleSend(promptText, []);
	};

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
			{/* Chat Top Navbar */}
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

					{showModelMenu && (
						<div className="popover-menu model-dropdown-popover">
							<div className="popover-header">
								<span>Modelos Disponibles</span>
							</div>
							{AVAILABLE_MODELS.map((m) => (
								<button
									key={m.id}
									type="button"
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
											<span className="model-tag-badge">{m.badge}</span>
										</div>
										<span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{m.desc}</span>
									</div>
									{m.id === selectedModel && (
										<CheckIcon size={15} style={{ color: "var(--accent)" }} />
									)}
								</button>
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
								<MessageBubble key={msg.id} message={msg} />
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
		</div>
	);
}
