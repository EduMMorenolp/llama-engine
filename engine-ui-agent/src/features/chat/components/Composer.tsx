import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTools } from "../../../api.ts";
import { PlusIcon, SendIcon, StopIcon, WrenchIcon } from "../../../components/ui/Icons.tsx";
import { AttachMenu } from "./AttachMenu.tsx";
import { type FileAttachment, FileUpload, useFileUpload } from "./FileUpload.tsx";
import { MCPServersModal } from "./MCPServersModal.tsx";
import { SystemPromptModal } from "./SystemPromptModal.tsx";
import { type ToolConfig, ToolSelector } from "./ToolSelector.tsx";

interface ComposerProps {
	onSend: (
		text: string,
		attachments: FileAttachment[],
		options?: { systemPrompt?: string; enabledTools?: string[] },
	) => void;
	onStop: () => void;
	disabled: boolean;
	model?: string;
	tokenCount?: number;
}

const DEFAULT_TOOLS: ToolConfig[] = [
	{ name: "bash", label: "Bash Terminal", enabled: true },
	{ name: "read_file", label: "Read File", enabled: true },
	{ name: "write_file", label: "Write File", enabled: true },
	{ name: "edit_file", label: "Edit File", enabled: true },
	{ name: "glob_search", label: "Glob Search", enabled: true },
	{ name: "grep_search", label: "Grep Search", enabled: true },
	{ name: "memorize", label: "Memorize", enabled: true },
	{ name: "search_memories", label: "Search Memories", enabled: true },
];

export function Composer({
	onSend,
	onStop,
	disabled,
	model = "qwen3.5",
	tokenCount = 0,
}: ComposerProps) {
	const [text, setText] = useState("");
	const [showAttachMenu, setShowAttachMenu] = useState(false);
	const [showToolSelector, setShowToolSelector] = useState(false);
	const [showSystemPrompt, setShowSystemPrompt] = useState(false);
	const [showMCPServers, setShowMCPServers] = useState(false);
	const [systemPrompt, setSystemPrompt] = useState(
		"Sos un asistente de IA experto en desarrollo de software y resolución de problemas.",
	);
	const [tools, setTools] = useState(DEFAULT_TOOLS);
	const [attachments, setAttachments] = useState<FileAttachment[]>([]);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const { processFiles } = useFileUpload();

	// Fetch dynamic tools from agent backend API
	useEffect(() => {
		fetchTools()
			.then((serverTools) => {
				if (serverTools && serverTools.length > 0) {
					setTools(
						serverTools.map((st) => ({
							name: st.name,
							label: st.description || st.name,
							enabled: st.enabled ?? true,
						})),
					);
				}
			})
			.catch(() => {
				// Fallback to default tools
			});
	}, []);

	// Auto-resize textarea according to scrollHeight and text content
	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			const nextHeight = Math.min(textarea.scrollHeight, 200);
			textarea.style.height = `${Math.max(nextHeight, 24)}px`;
			if (text.length >= 0) {
				// text tracked
			}
		}
	}, [text]);

	const handleSend = useCallback(() => {
		const trimmed = text.trim();
		if (!trimmed && attachments.length === 0) return;
		if (disabled) return;
		const enabledTools = tools.filter((t) => t.enabled).map((t) => t.name);
		onSend(trimmed, attachments, { systemPrompt, enabledTools });
		setText("");
		setAttachments([]);
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
	}, [text, attachments, disabled, onSend, systemPrompt, tools]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	const handleFiles = useCallback(
		async (fileList: FileList) => {
			const newAttachments = await processFiles(fileList);
			setAttachments((prev) => [...prev, ...newAttachments]);
		},
		[processFiles],
	);

	const handleToggleTool = useCallback((name: string) => {
		setTools((prev) => prev.map((t) => (t.name === name ? { ...t, enabled: !t.enabled } : t)));
	}, []);

	const handleAddFiles = useCallback(() => {
		setShowAttachMenu(false);
		const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
		input?.click();
	}, []);

	const handleSystemMessage = useCallback(() => {
		setShowAttachMenu(false);
		setShowSystemPrompt(true);
	}, []);

	const handleMCPServers = useCallback(() => {
		setShowAttachMenu(false);
		setShowMCPServers(true);
	}, []);

	const activeToolsCount = tools.filter((t) => t.enabled).length;

	return (
		<div className="composer-outer">
			<div className="composer-box">
				{showSystemPrompt && (
					<SystemPromptModal
						prompt={systemPrompt}
						onSave={setSystemPrompt}
						onClose={() => setShowSystemPrompt(false)}
					/>
				)}

				{showMCPServers && <MCPServersModal onClose={() => setShowMCPServers(false)} />}

				{showToolSelector && (
					<ToolSelector
						tools={tools}
						onToggle={handleToggleTool}
						onClose={() => setShowToolSelector(false)}
					/>
				)}

				{showAttachMenu && (
					<AttachMenu
						onAddFiles={handleAddFiles}
						onSystemMessage={handleSystemMessage}
						onMCPServers={handleMCPServers}
						onClose={() => setShowAttachMenu(false)}
					/>
				)}

				<FileUpload
					attachments={attachments}
					onAdd={handleFiles}
					onRemove={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
				/>

				<div className="composer-input-row">
					<textarea
						ref={textareaRef}
						className="composer-textarea"
						placeholder="Escribe un mensaje o usa las herramientas del agente..."
						value={text}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={handleKeyDown}
						disabled={disabled}
						rows={1}
					/>
				</div>

				<div className="composer-bottom-row">
					<div className="composer-bottom-left">
						<button
							type="button"
							className="composer-btn-icon"
							onClick={() => {
								setShowToolSelector(false);
								setShowAttachMenu(!showAttachMenu);
							}}
							title="Adjuntar y opciones"
						>
							<PlusIcon size={18} />
						</button>

						<button
							type="button"
							className="composer-btn-icon"
							onClick={() => {
								setShowAttachMenu(false);
								setShowToolSelector(!showToolSelector);
							}}
							title="Configuración de herramientas"
							style={{
								position: "relative",
								color: activeToolsCount > 0 ? "var(--accent)" : "inherit",
							}}
						>
							<WrenchIcon size={16} />
						</button>
					</div>

					<div className="composer-bottom-right">
						<span
							style={{ fontSize: "11px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}
						>
							{model}
						</span>
						{tokenCount > 0 && <span className="token-badge">{tokenCount} tokens</span>}

						<button
							type="button"
							className={`send-action-btn ${disabled ? "stop" : ""}`}
							onClick={disabled ? onStop : handleSend}
							disabled={!disabled && !text.trim() && attachments.length === 0}
							title={disabled ? "Detener respuesta" : "Enviar mensaje (Enter)"}
						>
							{disabled ? <StopIcon size={14} /> : <SendIcon size={16} />}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
