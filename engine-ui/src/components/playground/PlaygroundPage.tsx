import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { type ChatContentPart, type ChatMessagePayload, streamChatCompletion } from "../../api";
import { useToast } from "../../context/ToastContext";
import { useModels } from "../../hooks/useModels";
import { useRuntime } from "../../hooks/useRuntime";
import { Button } from "../ui/Button";
import {
	IconBolt,
	IconCopy,
	IconDownload,
	IconEye,
	IconImage,
	IconPlayground,
	IconSend,
	IconSliders,
	IconStop,
	IconTrash,
	IconX,
} from "../ui/Icons";
import { PageHeader } from "../ui/PageHeader";

interface UiMessage {
	id: string;
	role: "user" | "assistant";
	text: string;
	imageDataUrl?: string;
	tokPerSec?: number;
	elapsedSec?: number;
	approxTokens?: number;
}

const PROMPT_PRESETS = [
	{
		label: "Explicar arquitectura CUDA",
		prompt:
			"Explicá brevemente por qué Flash Attention y la cuantización Q4_K_M reducen el consumo de VRAM en inferencia local con llama.cpp.",
	},
	{
		label: "Generar script Python",
		prompt:
			"Escribí un cliente Python limpio que consuma un endpoint compatible con OpenAI (/v1/chat/completions) usando streaming.",
	},
	{
		label: "Estructurar JSON",
		prompt:
			"Devolvé un objeto JSON válido con 3 casos de uso recomendados para modelos locales de 4B a 9B parámetros.",
	},
];

export function PlaygroundPage() {
	const [searchParams] = useSearchParams();
	const { status, refresh } = useRuntime();
	const modelActions = useModels(status?.models ?? [], refresh);
	const toast = useToast();

	const registry = status?.models ?? [];
	const [selectedModel, setSelectedModel] = useState(
		() => searchParams.get("model") || status?.loadedModel || "",
	);
	const [messages, setMessages] = useState<UiMessage[]>([]);
	const [input, setInput] = useState("");
	const [attachedImage, setAttachedImage] = useState<string | null>(null);
	const [streaming, setStreaming] = useState(false);
	const [showParams, setShowParams] = useState(false);

	// Sampling parameters
	const [systemPrompt, setSystemPrompt] = useState(
		"Sos un asistente técnico preciso, claro y conciso ejecutándose localmente en llama-engine.",
	);
	const [temperature, setTemperature] = useState(0.7);
	const [topP, setTopP] = useState(0.9);
	const [maxTokens, setMaxTokens] = useState(1024);

	const abortRef = useRef<AbortController | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const chatEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!selectedModel && status?.loadedModel) {
			setSelectedModel(status.loadedModel);
		}
	}, [selectedModel, status?.loadedModel]);

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
	});

	const currentModelInfo = registry.find((m) => m.id === selectedModel);
	const isModelLoaded = Boolean(selectedModel && selectedModel === status?.loadedModel);

	const handleAttachImage = (file: File) => {
		if (!file.type.startsWith("image/")) {
			toast.warning("Archivo no válido", "Seleccioná una imagen PNG, JPG o WebP.");
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === "string") {
				setAttachedImage(reader.result);
			}
		};
		reader.readAsDataURL(file);
	};

	const handleSend = async (promptText?: string) => {
		const textToSend = (promptText ?? input).trim();
		if ((!textToSend && !attachedImage) || streaming) return;

		const targetModel = selectedModel || status?.loadedModel || "default";
		const userMsg: UiMessage = {
			id: `u-${Date.now()}`,
			role: "user",
			text: textToSend,
			imageDataUrl: attachedImage ?? undefined,
		};
		const assistantId = `a-${Date.now()}`;
		const assistantPlaceholder: UiMessage = {
			id: assistantId,
			role: "assistant",
			text: "",
		};

		const nextHistory = [...messages, userMsg];
		setMessages([...nextHistory, assistantPlaceholder]);
		if (!promptText) setInput("");
		setAttachedImage(null);
		setStreaming(true);

		const apiMessages: ChatMessagePayload[] = [];
		if (systemPrompt.trim()) {
			apiMessages.push({ role: "system", content: systemPrompt.trim() });
		}
		for (const m of nextHistory) {
			if (m.role === "user" && m.imageDataUrl) {
				const parts: ChatContentPart[] = [];
				if (m.text) parts.push({ type: "text", text: m.text });
				parts.push({ type: "image_url", image_url: { url: m.imageDataUrl } });
				apiMessages.push({ role: "user", content: parts });
			} else {
				apiMessages.push({ role: m.role, content: m.text });
			}
		}

		const ctrl = new AbortController();
		abortRef.current = ctrl;
		const startedAt = performance.now();
		let accumulated = "";
		let chunksCount = 0;

		try {
			await streamChatCompletion({
				model: targetModel,
				messages: apiMessages,
				temperature,
				topP,
				maxTokens,
				signal: ctrl.signal,
				onToken: (delta) => {
					accumulated += delta;
					chunksCount += 1;
					const elapsedSec = Math.max(0.1, (performance.now() - startedAt) / 1000);
					const tokPerSec = chunksCount / elapsedSec;
					setMessages((prev) =>
						prev.map((item) =>
							item.id === assistantId
								? {
										...item,
										text: accumulated,
										elapsedSec,
										tokPerSec,
										approxTokens: chunksCount,
									}
								: item,
						),
					);
				},
			});
		} catch (err) {
			if ((err as { name?: string })?.name === "AbortError") {
				toast.info("Generación detenida", "Se canceló la respuesta en curso.");
			} else {
				const msg = err instanceof Error ? err.message : String(err);
				toast.error("Error en inferencia /v1", msg);
				setMessages((prev) =>
					prev.map((item) =>
						item.id === assistantId
							? {
									...item,
									text: accumulated
										? `${accumulated}\n\n[Error: ${msg}]`
										: `No se pudo completar la inferencia: ${msg}`,
								}
							: item,
					),
				);
			}
		} finally {
			setStreaming(false);
			abortRef.current = null;
			refresh();
		}
	};

	const handleStop = () => {
		abortRef.current?.abort();
	};

	const handleCopy = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success("Copiado al portapapeles");
		} catch {
			toast.error("No se pudo copiar");
		}
	};

	const handleExportJsonl = () => {
		if (messages.length === 0) return;
		const entry = {
			messages: [
				...(systemPrompt.trim() ? [{ role: "system", content: systemPrompt.trim() }] : []),
				...messages.map((m) => ({ role: m.role, content: m.text })),
			],
		};
		const blob = new Blob([`${JSON.stringify(entry)}\n`], { type: "application/jsonl" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `chat-${selectedModel || "llama"}-${Date.now()}.jsonl`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success("Conversación exportada", "Lista para subir en la biblioteca de DataSets.");
	};

	return (
		<div className="page-stack">
			<PageHeader
				title="Playground Multimodal"
				description="Probá tus modelos GGUF en tiempo real vía /v1/chat/completions (Streaming SSE + Visión)"
				badge={currentModelInfo?.vision ? "Visión Activa" : "OpenAI /v1"}
				actions={
					<div className="action-row">
						<Button variant="ghost" size="sm" onClick={() => setShowParams((v) => !v)}>
							<IconSliders size={14} />
							<span>{showParams ? "Ocultar parámetros" : "Parámetros"}</span>
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleExportJsonl}
							disabled={messages.length === 0}
						>
							<IconDownload size={14} />
							<span>Exportar .jsonl</span>
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setMessages([])}
							disabled={messages.length === 0 || streaming}
						>
							<IconTrash size={14} />
							<span>Limpiar</span>
						</Button>
					</div>
				}
			/>

			{/* Model Bar */}
			<div className="playground-toolbar card">
				<div className="playground-toolbar-left">
					<div className="field field-inline">
						<label htmlFor="pg-model">Modelo</label>
						<select
							id="pg-model"
							value={selectedModel}
							onChange={(e) => setSelectedModel(e.target.value)}
						>
							{registry.length === 0 ? (
								<option value="">{status?.loadedModel || "Sin modelos"}</option>
							) : (
								registry.map((m) => (
									<option key={m.id} value={m.id}>
										{m.id} {m.vision ? "(Visión)" : "(Texto)"}{" "}
										{m.id === status?.loadedModel ? "· [En VRAM]" : ""}
									</option>
								))
							)}
						</select>
					</div>

					{selectedModel && !isModelLoaded ? (
						<Button
							size="sm"
							variant="primary"
							busy={modelActions.busyAction === "reload"}
							onClick={() => modelActions.reload(selectedModel)}
						>
							Cargar {selectedModel} en GPU
						</Button>
					) : null}
				</div>

				<div className="playground-toolbar-right">
					{currentModelInfo?.vision ? (
						<span className="badge badge-on">
							<IconEye size={13} /> Soporta imágenes (mmproj)
						</span>
					) : (
						<span className="badge badge-muted">Modelo de texto</span>
					)}
				</div>
			</div>

			{/* Collapsible Sampling Parameters */}
			{showParams ? (
				<section className="card playground-params">
					<div className="config-grid">
						<div className="field">
							<label htmlFor="pg-temp">Temperature ({temperature.toFixed(2)})</label>
							<input
								id="pg-temp"
								type="range"
								min={0}
								max={2}
								step={0.05}
								value={temperature}
								onChange={(e) => setTemperature(Number(e.target.value))}
							/>
							<span className="field-hint">
								0 = determinista · 0.7 = balanceado · 1.2+ = creativo
							</span>
						</div>

						<div className="field">
							<label htmlFor="pg-topp">Top-P ({topP.toFixed(2)})</label>
							<input
								id="pg-topp"
								type="range"
								min={0.1}
								max={1}
								step={0.05}
								value={topP}
								onChange={(e) => setTopP(Number(e.target.value))}
							/>
							<span className="field-hint">Nucleus sampling (recomendado 0.90)</span>
						</div>

						<div className="field">
							<label htmlFor="pg-maxtok">Max Tokens</label>
							<input
								id="pg-maxtok"
								type="number"
								min={64}
								max={16384}
								step={64}
								value={maxTokens}
								onChange={(e) => setMaxTokens(Number(e.target.value) || 512)}
							/>
							<span className="field-hint">Límite de tokens generados por respuesta</span>
						</div>
					</div>

					<div className="field">
						<label htmlFor="pg-sys">System Prompt</label>
						<textarea
							id="pg-sys"
							rows={2}
							value={systemPrompt}
							onChange={(e) => setSystemPrompt(e.target.value)}
						/>
					</div>
				</section>
			) : null}

			{/* Chat Viewport */}
			<div className="playground-chat card">
				<div className="playground-messages">
					{messages.length === 0 ? (
						<div className="playground-empty">
							<div className="playground-empty-icon">
								<IconPlayground size={32} />
							</div>
							<h3>Probá el motor en tiempo real</h3>
							<p className="muted">
								Enviá un mensaje o elegí una plantilla rápida para medir la velocidad de generación
								de <strong>{selectedModel || status?.loadedModel || "llama-server"}</strong>.
							</p>
							<div className="playground-presets">
								{PROMPT_PRESETS.map((p) => (
									<button
										key={p.label}
										type="button"
										className="preset-chip"
										onClick={() => handleSend(p.prompt)}
									>
										<IconBolt size={13} />
										<span>{p.label}</span>
									</button>
								))}
							</div>
						</div>
					) : (
						messages.map((m) => (
							<div key={m.id} className={`chat-bubble chat-bubble-${m.role}`}>
								<div className="chat-bubble-head">
									<span className="chat-role-badge">
										{m.role === "user" ? "Vos" : selectedModel || "Asistente"}
									</span>
									<div className="chat-bubble-meta">
										{m.tokPerSec ? (
											<span className="chat-speed-pill">
												<IconBolt size={12} />
												{m.tokPerSec.toFixed(1)} tok/s · {m.approxTokens} tok ·{" "}
												{m.elapsedSec?.toFixed(1)}s
											</span>
										) : null}
										{m.text ? (
											<button
												type="button"
												className="icon-btn icon-btn-sm"
												onClick={() => handleCopy(m.text)}
												title="Copiar mensaje"
												aria-label="Copiar mensaje"
											>
												<IconCopy size={13} />
											</button>
										) : null}
									</div>
								</div>

								{m.imageDataUrl ? (
									<img
										src={m.imageDataUrl}
										alt="Adjunto enviado al modelo"
										className="chat-attached-img"
									/>
								) : null}

								<div className="chat-bubble-content">
									{m.text || (streaming ? "Generando respuesta…" : "")}
								</div>
							</div>
						))
					)}
					<div ref={chatEndRef} />
				</div>

				{/* Attached Image Preview */}
				{attachedImage ? (
					<div className="chat-attachment-preview">
						<img src={attachedImage} alt="Previsualización" />
						<span className="muted small">Imagen lista para enviar (multimodal)</span>
						<button
							type="button"
							className="icon-btn icon-btn-sm"
							onClick={() => setAttachedImage(null)}
							aria-label="Quitar imagen"
						>
							<IconX size={14} />
						</button>
					</div>
				) : null}

				{/* Composer */}
				<form
					className="playground-composer"
					onSubmit={(e) => {
						e.preventDefault();
						void handleSend();
					}}
				>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						style={{ display: "none" }}
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) handleAttachImage(file);
							e.target.value = "";
						}}
					/>
					<button
						type="button"
						className="icon-btn"
						onClick={() => fileInputRef.current?.click()}
						title="Adjuntar imagen para modelos con visión"
						aria-label="Adjuntar imagen"
					>
						<IconImage size={17} />
					</button>

					<textarea
						rows={2}
						className="playground-input"
						placeholder="Escribí un mensaje… (Enter para enviar, Shift+Enter para salto de línea)"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								void handleSend();
							}
						}}
					/>

					{streaming ? (
						<Button variant="danger" onClick={handleStop}>
							<IconStop size={15} />
							<span>Detener</span>
						</Button>
					) : (
						<Button type="submit" variant="primary" disabled={!input.trim() && !attachedImage}>
							<IconSend size={15} />
							<span>Enviar</span>
						</Button>
					)}
				</form>
			</div>
		</div>
	);
}
