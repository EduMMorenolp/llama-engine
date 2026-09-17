import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import type { Message } from "../../../api.ts";
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	ClockIcon,
	CopyIcon,
	EditIcon,
	ForkIcon,
	LightbulbIcon,
	RefreshCwIcon,
	SparklesIcon,
	TerminalIcon,
	TrashIcon,
	UserIcon,
	XIcon,
	ZapIcon,
} from "../../../components/ui/Icons.tsx";

export interface ToolCallInfo {
	id?: string;
	name: string;
	args: Record<string, unknown>;
	result?: string;
	status: "pending" | "done" | "error";
}

interface MessageBubbleProps {
	message: Message;
	toolCalls?: ToolCallInfo[];
	isStreaming?: boolean;
	modelName?: string;
	onCopy?: (text: string) => void;
	onEdit?: (message: Message) => void;
	onReload?: (message: Message) => void;
	onFork?: (messageId: string) => void;
	onDelete?: (messageId: string) => void;
}

function parseThinking(content: string): { thinking: string; rest: string } {
	const match = content.match(/<think>([\s\S]*?)<\/think>/);
	if (match) {
		return {
			thinking: match[1].trim(),
			rest: content.replace(/<think>[\s\S]*?<\/think>/, "").trim(),
		};
	}
	return { thinking: "", rest: content };
}

function CodeCopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<button
			type="button"
			className="code-copy-btn"
			onClick={handleCopy}
			title="Copiar fragmento de código"
		>
			{copied ? (
				<>
					<CheckIcon size={12} style={{ color: "var(--success)" }} />
					<span style={{ color: "var(--success)" }}>Copiado</span>
				</>
			) : (
				<>
					<CopyIcon size={12} />
					<span>Copiar</span>
				</>
			)}
		</button>
	);
}

function formatToolArgs(tc: any): string {
	if (!tc) return "";
	if (typeof tc.args === "string") return tc.args;
	if (tc.args && typeof tc.args === "object") {
		try {
			return JSON.stringify(tc.args);
		} catch {
			return "";
		}
	}
	if (tc.function?.arguments) {
		return typeof tc.function.arguments === "string"
			? tc.function.arguments
			: JSON.stringify(tc.function.arguments);
	}
	return "";
}

function getToolName(tc: any): string {
	return tc?.name || tc?.function?.name || "herramienta";
}

function getToolStatus(tc: any): "pending" | "done" | "error" {
	if (tc?.status === "pending" || tc?.status === "done" || tc?.status === "error") {
		return tc.status;
	}
	return "done";
}

export function MessageBubble({
	message,
	toolCalls = [],
	isStreaming = false,
	modelName = "qwen3.5-9b",
	onCopy,
	onEdit,
	onReload,
	onFork,
	onDelete,
}: MessageBubbleProps) {
	const isUser = message.role === "user";
	const isTool = message.role === "tool";
	const [copiedMsg, setCopiedMsg] = useState(false);
	const [thinkingOpen, setThinkingOpen] = useState(true);

	if (isTool) return null;

	const content = message.content ?? "";
	const { thinking, rest } = parseThinking(content);
	const displayContent = rest || content;

	// Estimate token metrics
	const tokenCount = Math.max(1, Math.round(displayContent.length / 3.8));
	const durationSeconds = (tokenCount / (isUser ? 600 : 45)).toFixed(1);
	const tokensPerSecond = isUser ? "662.66" : (tokenCount / Math.max(0.2, parseFloat(durationSeconds))).toFixed(2);

	// Parse tool calls safely from message if present as JSON string or array
	let parsedToolCalls: any[] = Array.isArray(toolCalls) ? toolCalls : [];
	if (parsedToolCalls.length === 0 && message.toolCalls) {
		try {
			const parsed = typeof message.toolCalls === "string" ? JSON.parse(message.toolCalls) : message.toolCalls;
			if (Array.isArray(parsed)) {
				parsedToolCalls = parsed;
			}
		} catch {
			parsedToolCalls = [];
		}
	}

	const handleCopyMessage = async () => {
		await navigator.clipboard.writeText(displayContent);
		setCopiedMsg(true);
		onCopy?.(displayContent);
		setTimeout(() => setCopiedMsg(false), 2000);
	};

	return (
		<div className={`message-row ${isUser ? "user" : "assistant"}`}>
			<div className={`message-avatar ${isUser ? "user" : "assistant"}`}>
				{isUser ? <UserIcon size={18} /> : <SparklesIcon size={18} />}
			</div>

			<div className="message-body-container">
				{/* Top Performance Stats for Message */}
				<div className={`message-stats-header ${isUser ? "user" : "assistant"}`}>
					<span className="stat-pill">
						<span style={{ fontFamily: "var(--font-mono)", opacity: 0.7 }}>ab</span>
						<span>{tokenCount} tokens</span>
					</span>
					<span className="stat-pill">
						<ClockIcon size={11} />
						<span>{durationSeconds}s</span>
					</span>
					<span className="stat-pill">
						<ZapIcon size={11} />
						<span>{tokensPerSecond} {isUser ? "tokens/s" : "t/s"}</span>
					</span>
				</div>

				<div className={`message-bubble ${isUser ? "user" : "assistant"}`}>
					{/* DeepSeek R1 / Qwen Reasoning Container */}
					{thinking && (
						<div className="thinking-container">
							<button
								type="button"
								className="thinking-header"
								onClick={() => setThinkingOpen(!thinkingOpen)}
								style={{ width: "100%", border: "none", textAlign: "left" }}
							>
								<div className="thinking-header-left">
									<LightbulbIcon size={15} style={{ color: "var(--accent)" }} />
									<span style={{ fontWeight: 600 }}>Reasoning</span>
								</div>
								{thinkingOpen ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
							</button>
							{thinkingOpen && <div className="thinking-body">{thinking}</div>}
						</div>
					)}

					{/* Tool Execution Cards */}
					{parsedToolCalls.length > 0 && (
						<div className="tool-calls-container">
							{parsedToolCalls.map((tc, idx) => {
								const toolName = getToolName(tc);
								const toolStatus = getToolStatus(tc);
								const rawArgsStr = formatToolArgs(tc);
								const toolArgsStr =
									rawArgsStr.length > 75 ? `${rawArgsStr.slice(0, 75)}...` : rawArgsStr;

								return (
									<div
										key={tc.id || `${toolName}-${toolStatus}-${idx}`}
										className={`tool-call-card ${toolStatus}`}
									>
										<div className="tool-call-left">
											<TerminalIcon size={14} style={{ color: "var(--accent)" }} />
											<span className="tool-call-name">{toolName}</span>
											{toolArgsStr && <span className="tool-call-args">{toolArgsStr}</span>}
										</div>
										<div className="tool-call-status">
											{toolStatus === "pending" ? (
												<span style={{ color: "var(--warning)", fontSize: "11px" }}>
													Ejecutando...
												</span>
											) : toolStatus === "done" ? (
												<CheckIcon size={14} style={{ color: "var(--success)" }} />
											) : (
												<XIcon size={14} style={{ color: "var(--danger)" }} />
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}

					{/* Message Content */}
					<div className={`message-content ${isUser ? "user-bubble-content" : ""}`}>
						<div className="markdown-content">
							<ReactMarkdown
								remarkPlugins={[remarkGfm]}
								components={{
									img(props) {
										const { src, alt } = props;
										if (!src) return null;
										return (
											<div className="attached-media-container">
												<img
													src={src}
													alt={alt || "Imagen adjunta"}
													className="attached-media-img"
													loading="lazy"
													onClick={() => window.open(src, "_blank")}
													title="Ver imagen en tamaño completo"
												/>
												{alt && <div className="attached-media-name">{alt}</div>}
											</div>
										);
									},
									code(props) {
										const { children, className, ...rest } = props;
										const match = /language-(\w+)/.exec(className || "");
										const codeString = String(children).replace(/\n$/, "");

										if (match) {
											return (
												<div className="code-block-wrapper">
													<div className="code-block-header">
														<span className="code-lang-label">{match[1]}</span>
														<CodeCopyButton text={codeString} />
													</div>
													<SyntaxHighlighter
														style={oneDark}
														language={match[1]}
														PreTag="div"
														customStyle={{
															margin: 0,
															background: "#0d1017",
															fontSize: "13px",
															padding: "12px 14px",
															fontFamily: "var(--font-mono)",
															lineHeight: 1.5,
														}}
													>
														{codeString}
													</SyntaxHighlighter>
												</div>
											);
										}
										return (
											<code className="inline-code" {...rest}>
												{children}
											</code>
										);
									},
									a(props) {
										const { children, href } = props;
										return (
											<a href={href} target="_blank" rel="noopener noreferrer">
												{children}
											</a>
										);
									},
									table(props) {
										return (
											<div className="table-wrapper">
												<table {...props} />
											</div>
										);
									},
								}}
							>
								{displayContent}
							</ReactMarkdown>
						</div>

						{isStreaming && <span className="streaming-cursor" />}
					</div>
				</div>

				{/* Message Bottom Action Bar */}
				<div className={`message-actions-bar ${isUser ? "user" : "assistant"}`}>
					{!isUser && (
						<div className="message-model-pill">
							<span className="model-pill-icon">⬡</span>
							<span className="model-pill-name">{modelName}</span>
						</div>
					)}

					<div className="actions-cluster">
						<button
							type="button"
							className="action-icon-btn"
							title="Copiar mensaje"
							onClick={handleCopyMessage}
						>
							{copiedMsg ? (
								<CheckIcon size={14} style={{ color: "var(--success)" }} />
							) : (
								<CopyIcon size={14} />
							)}
						</button>

						{isUser && onEdit && (
							<button
								type="button"
								className="action-icon-btn"
								title="Editar mensaje"
								onClick={() => onEdit(message)}
							>
								<EditIcon size={14} />
							</button>
						)}

						{onReload && (
							<button
								type="button"
								className="action-icon-btn"
								title={isUser ? "Reenviar mensaje" : "Regenerar respuesta"}
								onClick={() => onReload(message)}
							>
								<RefreshCwIcon size={14} />
							</button>
						)}

						{onFork && (
							<button
								type="button"
								className="action-icon-btn"
								title="Bifurcar conversación desde este punto"
								onClick={() => onFork(message.id)}
							>
								<ForkIcon size={14} />
							</button>
						)}

						{onDelete && (
							<button
								type="button"
								className="action-icon-btn danger-hover"
								title="Eliminar mensaje"
								onClick={() => onDelete(message.id)}
							>
								<TrashIcon size={14} />
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
