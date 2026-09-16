import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import type { Message } from "../../../api.ts";
import {
	BrainIcon,
	CheckIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	CopyIcon,
	SparklesIcon,
	TerminalIcon,
	UserIcon,
	XIcon,
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

export function MessageBubble({
	message,
	toolCalls = [],
	isStreaming = false,
}: MessageBubbleProps) {
	const isUser = message.role === "user";
	const isTool = message.role === "tool";
	const [copiedMsg, setCopiedMsg] = useState(false);
	const [thinkingOpen, setThinkingOpen] = useState(true);

	if (isTool) return null;

	const content = message.content ?? "";
	const { thinking, rest } = parseThinking(content);
	const displayContent = rest || content;

	// Parse tool calls from message if present as JSON string
	let parsedToolCalls = toolCalls;
	if (parsedToolCalls.length === 0 && message.toolCalls) {
		try {
			parsedToolCalls = JSON.parse(message.toolCalls);
		} catch {
			// ignore
		}
	}

	const handleCopyMessage = async () => {
		await navigator.clipboard.writeText(displayContent);
		setCopiedMsg(true);
		setTimeout(() => setCopiedMsg(false), 2000);
	};

	return (
		<div className={`message-row ${isUser ? "user" : "assistant"}`}>
			<div className={`message-avatar ${isUser ? "user" : "assistant"}`}>
				{isUser ? <UserIcon size={18} /> : <SparklesIcon size={18} />}
			</div>

			<div className="message-body-container">
				<div className={`message-bubble ${isUser ? "user" : "assistant"}`}>
					{/* DeepSeek R1 / Gemini Thinking Process */}
					{thinking && (
						<div className="thinking-container">
							<button
								type="button"
								className="thinking-header"
								onClick={() => setThinkingOpen(!thinkingOpen)}
								style={{ width: "100%", border: "none", textAlign: "left" }}
							>
								<div className="thinking-header-left">
									<BrainIcon size={15} className="thinking-sparkle-pulse" />
									<span>Proceso de Razonamiento</span>
								</div>
								{thinkingOpen ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
							</button>
							{thinkingOpen && <div className="thinking-body">{thinking}</div>}
						</div>
					)}

					{/* Tool Execution Cards */}
					{parsedToolCalls.length > 0 && (
						<div className="tool-calls-container">
							{parsedToolCalls.map((tc, idx) => (
								<div
									key={tc.id || `${tc.name}-${tc.status}-${idx}`}
									className={`tool-call-card ${tc.status}`}
								>
									<div className="tool-call-left">
										<TerminalIcon size={14} style={{ color: "var(--accent)" }} />
										<span className="tool-call-name">{tc.name}</span>
										<span className="tool-call-args">
											{JSON.stringify(tc.args).slice(0, 75)}
											{JSON.stringify(tc.args).length > 75 ? "..." : ""}
										</span>
									</div>
									<div className="tool-call-status">
										{tc.status === "pending" ? (
											<span style={{ color: "var(--warning)", fontSize: "11px" }}>
												Ejecutando...
											</span>
										) : tc.status === "done" ? (
											<CheckIcon size={14} style={{ color: "var(--success)" }} />
										) : (
											<XIcon size={14} style={{ color: "var(--danger)" }} />
										)}
									</div>
								</div>
							))}
						</div>
					)}

					{/* Message Content */}
					<div className="message-content">
						{isUser ? (
							<div className="user-text">{displayContent}</div>
						) : (
							<div className="markdown-content">
								<ReactMarkdown
									remarkPlugins={[remarkGfm]}
									components={{
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
						)}

						{isStreaming && <span className="streaming-cursor" />}
					</div>
				</div>

				{/* Message Footer Bar on Assistant response */}
				{!isUser && (
					<div className="message-actions-bar">
						<button
							type="button"
							className="action-icon-btn"
							title="Copiar respuesta completa"
							onClick={handleCopyMessage}
						>
							{copiedMsg ? (
								<>
									<CheckIcon size={13} style={{ color: "var(--success)" }} />
									<span style={{ color: "var(--success)", fontSize: "11px" }}>Copiado</span>
								</>
							) : (
								<>
									<CopyIcon size={13} />
									<span style={{ fontSize: "11px" }}>Copiar</span>
								</>
							)}
						</button>
						<span className="message-timestamp">
							{new Date(message.createdAt).toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
