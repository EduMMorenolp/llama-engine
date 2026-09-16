import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
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
	const { sidebarOpen, toggleSidebar } = useOutletContext<LayoutContextType>() ?? {
		sidebarOpen: true,
		toggleSidebar: () => {},
	};

	const [selectedModel, setSelectedModel] = useState("qwen3.5-agent");

	const cycleModel = () => {
		const models = ["qwen3.5-agent", "llama3.3-70b", "deepseek-r1", "claude-3.5"];
		const nextIdx = (models.indexOf(selectedModel) + 1) % models.length;
		setSelectedModel(models[nextIdx]);
	};

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
		_attachments: FileAttachment[],
		options?: { systemPrompt?: string },
	) => {
		let sessionId = activeSessionId;
		if (!sessionId) {
			const session = await createNewSession(undefined, selectedModel);
			sessionId = session.id;
		}

		addMessage({
			id: crypto.randomUUID?.() ?? Date.now().toString(),
			sessionId,
			role: "user",
			content: text,
			toolCalls: null,
			toolCallId: null,
			createdAt: Date.now(),
		});

		sendMessage(
			sessionId,
			text,
			{ model: selectedModel, systemPrompt: options?.systemPrompt },
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
				<div className="chat-navbar-left">
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
						onClick={cycleModel}
						title="Cambiar modelo de IA"
					>
						<span className="model-dot" />
						<span>{selectedModel}</span>
						<ChevronDownIcon size={14} style={{ color: "var(--text-muted)" }} />
					</button>
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
