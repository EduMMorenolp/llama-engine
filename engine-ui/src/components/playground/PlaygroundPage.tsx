import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
	appendDatasetExample,
	type ChatContentPart,
	type ChatMessagePayload,
	streamChatCompletion,
} from "../../api";
import { useToast } from "../../context/ToastContext";
import { useModels } from "../../hooks/useModels";
import { useRuntime } from "../../hooks/useRuntime";
import { Button } from "../ui/Button";
import {
	IconBolt,
	IconCopy,
	IconDatabase,
	IconDownload,
	IconEye,
	IconImage,
	IconPlayground,
	IconPlus,
	IconRefresh,
	IconSend,
	IconSliders,
	IconStop,
	IconTrash,
	IconX,
} from "../ui/Icons";
import { MarkdownContent } from "../ui/MarkdownContent";
import { PageHeader } from "../ui/PageHeader";

export interface UiMessage {
	id: string;
	role: "user" | "assistant";
	text: string;
	reasoningText?: string;
	imageDataUrl?: string;
	ttftMs?: number;
	tokPerSec?: number;
	elapsedSec?: number;
	approxTokens?: number;
}

export interface ChatSession {
	id: string;
	title: string;
	model: string;
	systemPrompt: string;
	updatedAt: number;
	messages: UiMessage[];
}

const SESSIONS_STORAGE_KEY = "llama-engine-chat-sessions";

const SYSTEM_PERSONAS = [
	{
		id: "default",
		label: "Asistente Técnico",
		prompt:
			"Sos un asistente técnico preciso, claro y conciso ejecutándose localmente en llama-engine.",
	},
	{
		id: "architect",
		label: "Arquitecto de Software",
		prompt:
			"Sos un Arquitecto de Software Senior. Priorizá código limpio en TypeScript/Python, seguridad, rendimiento y patrones probados.",
	},
	{
		id: "reasoner",
		label: "Razonador Paso a Paso (<think>)",
		prompt:
			"Antes de responder, razoná paso a paso dentro de etiquetas <think>...</think> y luego entregá la solución final verificada.",
	},
	{
		id: "json",
		label: "Extractor JSON Estricto",
		prompt:
			"Respondé únicamente con objetos JSON válidos sin texto introductorio ni bloques markdown adicionales.",
	},
];

const PROMPT_PRESETS = [
	{
		label: "Explicar arquitectura CUDA & KV Cache",
		prompt:
			"Explicá brevemente por qué Flash Attention y la cuantización KV Q8_0 reducen el consumo de VRAM en inferencia local con llama.cpp.",
	},
	{
		label: "Generar cliente TypeScript SSE",
		prompt:
			"Escribí una función TypeScript moderna que consuma `/v1/chat/completions` con `stream: true` y procese eventos SSE línea por línea.",
	},
	{
		label: "Razonamiento lógico",
		prompt:
			"Si tengo una GPU con 8 GB de VRAM y un modelo de 4.9 GB en Q4_K_M, ¿cuánta VRAM queda libre para el KV cache y qué tamaño de contexto recomendarías?",
	},
];

function createEmptySession(model: string): ChatSession {
	return {
		id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
		title: "Nueva conversación",
		model,
		systemPrompt: SYSTEM_PERSONAS[0].prompt,
		updatedAt: Date.now(),
		messages: [],
	};
}

export function PlaygroundPage() {
	const [searchParams] = useSearchParams();
	const { status, refresh } = useRuntime();
	const modelActions = useModels(status?.models ?? [], refresh);
	const toast = useToast();

	const registry = status?.models ?? [];
	const [selectedModel, setSelectedModel] = useState(
		() => searchParams.get("model") || status?.loadedModel || "",
	);

	// Multi-session state
	const [sessions, setSessions] = useState<ChatSession[]>(() => {
		try {
			const raw = window.localStorage.getItem(SESSIONS_STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw) as ChatSession[];
				if (Array.isArray(parsed) && parsed.length > 0) return parsed;
			}
		} catch {}
		return [createEmptySession(searchParams.get("model") || "")];
	});
	const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0]?.id ?? "");

	const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];
	const messages = activeSession?.messages ?? [];

	const [input, setInput] = useState("");
	const [attachedImage, setAttachedImage] = useState<string | null>(null);
	const [streaming, setStreaming] = useState(false);
	const [showParams, setShowParams] = useState(false);
	const [datasetTargetName, setDatasetTargetName] = useState("playground-curated");

	// Sampling parameters
	const [systemPrompt, setSystemPrompt] = useState(
		() => activeSession?.systemPrompt || SYSTEM_PERSONAS[0].prompt,
	);
	const [temperature, setTemperature] = useState(0.7);
	const [topP, setTopP] = useState(0.9);
	const [topK, setTopK] = useState(40);
	const [minP, setMinP] = useState(0.05);
	const [repeatPenalty, setRepeatPenalty] = useState(1.1);
	const [maxTokens, setMaxTokens] = useState(1024);
	const [jsonMode, setJsonMode] = useState(false);

	const abortRef = useRef<AbortController | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const chatEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!selectedModel && status?.loadedModel) {
			setSelectedModel(status.loadedModel);
		}
	}, [selectedModel, status?.loadedModel]);

	useEffect(() => {
		try {
			window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions.slice(0, 25)));
		} catch {}
	}, [sessions]);

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
	});

	const updateActiveSessionMessages = (
		updater: (prev: UiMessage[]) => UiMessage[],
		newTitleCandidate?: string,
	) => {
		setSessions((prev) =>
			prev.map((s) => {
				if (s.id !== activeSession.id) return s;
				const nextMsgs = updater(s.messages);
				const nextTitle =
					s.title === "Nueva conversación" && newTitleCandidate
						? newTitleCandidate.slice(0, 42)
						: s.title;
				return {
					...s,
					title: nextTitle,
					model: selectedModel || s.model,
					systemPrompt,
					updatedAt: Date.now(),
					messages: nextMsgs,
				};
			}),
		);
	};

	const handleNewSession = () => {
		if (streaming) return;
		const fresh = createEmptySession(selectedModel || status?.loadedModel || "");
		setSessions((prev) => [fresh, ...prev]);
		setActiveSessionId(fresh.id);
		setInput("");
		setAttachedImage(null);
	};

	const handleDeleteSession = (id: string) => {
		if (streaming) return;
		setSessions((prev) => {
			const remaining = prev.filter((s) => s.id !== id);
			if (remaining.length === 0) {
				const fallback = createEmptySession(selectedModel || status?.loadedModel || "");
				setActiveSessionId(fallback.id);
				return [fallback];
			}
			if (id === activeSession.id) {
				setActiveSessionId(remaining[0].id);
			}
			return remaining;
		});
	};

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

	const runCompletionStream = async (historyToUse: UiMessage[]) => {
		const targetModel = selectedModel || status?.loadedModel || "default";
		const assistantId = `a-${Date.now()}`;
		const assistantPlaceholder: UiMessage = {
			id: assistantId,
			role: "assistant",
			text: "",
			reasoningText: "",
		};

		const firstUserText = historyToUse.find((m) => m.role === "user")?.text;
		updateActiveSessionMessages(() => [...historyToUse, assistantPlaceholder], firstUserText);
		setStreaming(true);

		const apiMessages: ChatMessagePayload[] = [];
		if (systemPrompt.trim()) {
			apiMessages.push({ role: "system", content: systemPrompt.trim() });
		}
		for (const m of historyToUse) {
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
		let firstTokAt: number | null = null;
		let accumulated = "";
		let accumulatedReasoning = "";
		let chunksCount = 0;

		try {
			await streamChatCompletion({
				model: targetModel,
				messages: apiMessages,
				temperature,
				topP,
				topK,
				minP,
				repeatPenalty,
				maxTokens,
				jsonMode,
				signal: ctrl.signal,
				onToken: (delta, reasoningDelta) => {
					if (firstTokAt === null) firstTokAt = performance.now();
					if (delta) accumulated += delta;
					if (reasoningDelta) accumulatedReasoning += reasoningDelta;
					chunksCount += 1;
					const elapsedSec = Math.max(0.1, (performance.now() - startedAt) / 1000);
					const tokPerSec = chunksCount / elapsedSec;
					const ttftMs = Math.round(firstTokAt - startedAt);
					updateActiveSessionMessages((prev) =>
						prev.map((item) =>
							item.id === assistantId
								? {
										...item,
										text: accumulated,
										reasoningText: accumulatedReasoning || undefined,
										ttftMs,
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
				updateActiveSessionMessages((prev) =>
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

	const handleSend = async (promptText?: string) => {
		const textToSend = (promptText ?? input).trim();
		if ((!textToSend && !attachedImage) || streaming) return;

		const userMsg: UiMessage = {
			id: `u-${Date.now()}`,
			role: "user",
			text: textToSend,
			imageDataUrl: attachedImage ?? undefined,
		};

		const nextHistory = [...messages, userMsg];
		if (!promptText) setInput("");
		setAttachedImage(null);
		await runCompletionStream(nextHistory);
	};

	const handleRegenerateLast = async () => {
		if (streaming || messages.length === 0) return;
		const copy = [...messages];
		if (copy[copy.length - 1]?.role === "assistant") {
			copy.pop();
		}
		if (copy.length === 0) return;
		await runCompletionStream(copy);
	};

	const handleSaveSessionToDataset = async () => {
		if (messages.length < 2) {
			toast.warning("Conversación vacía", "Necesitás al menos un turno de pregunta y respuesta.");
			return;
		}
		try {
			const payloadMsgs = [
				...(systemPrompt.trim() ? [{ role: "system", content: systemPrompt.trim() }] : []),
				...messages.map((m) => ({ role: m.role, content: m.text })),
			];
			const ds = await appendDatasetExample(
				datasetTargetName.trim() || "playground-curated",
				payloadMsgs,
			);
			toast.success(
				"Guardado en DataSets",
				`Agregado a "${ds.name}" (${ds.examples} ejemplos totales).`,
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error("No se pudo guardar en el dataset", msg);
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
				title="Playground Studio"
				description="Estudio interactivo multimodal con sesiones persistentes, bloques de razonamiento (<think>), Markdown y curación de DataSets"
				badge={currentModelInfo?.vision ? "Visión Activa" : "OpenAI /v1"}
				actions={
					<div className="action-row">
						<Button variant="ghost" size="sm" onClick={() => setShowParams((v) => !v)}>
							<IconSliders size={14} />
							<span>{showParams ? "Ocultar parámetros" : "Parámetros & Personas"}</span>
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleSaveSessionToDataset}
							disabled={messages.length < 2}
							title="Enviar esta conversación directamente a un dataset de entrenamiento en llama-trainer"
						>
							<IconDatabase size={14} />
							<span>Guardar en DataSet</span>
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
							onClick={() => updateActiveSessionMessages(() => [])}
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
					{jsonMode ? <span className="badge badge-warn">JSON Mode</span> : null}
				</div>
			</div>

			{/* Collapsible Sampling Parameters & Personas */}
			{showParams ? (
				<section className="card playground-params">
					<div className="ctx-presets-row">
						<span className="muted small">Personas / System Prompts:</span>
						{SYSTEM_PERSONAS.map((p) => (
							<button
								key={p.id}
								type="button"
								className={`preset-chip ${systemPrompt === p.prompt ? "active" : ""}`}
								onClick={() => setSystemPrompt(p.prompt)}
							>
								{p.label}
							</button>
						))}
					</div>

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
							<span className="field-hint">0 = determinista · 0.7 = balanceado</span>
						</div>

						<div className="field">
							<label htmlFor="pg-topp">Top-P ({topP.toFixed(2)})</label>
							<input
								id="pg-topp"
								type="range"
								min={0.05}
								max={1}
								step={0.05}
								value={topP}
								onChange={(e) => setTopP(Number(e.target.value))}
							/>
							<span className="field-hint">Nucleus sampling (0.90 rec.)</span>
						</div>

						<div className="field">
							<label htmlFor="pg-topk">Top-K ({topK})</label>
							<input
								id="pg-topk"
								type="number"
								min={0}
								max={200}
								value={topK}
								onChange={(e) => setTopK(Number(e.target.value) || 0)}
							/>
							<span className="field-hint">Candidatos por token (40 rec.)</span>
						</div>

						<div className="field">
							<label htmlFor="pg-minp">Min-P ({minP.toFixed(2)})</label>
							<input
								id="pg-minp"
								type="number"
								min={0}
								max={0.5}
								step={0.01}
								value={minP}
								onChange={(e) => setMinP(Number(e.target.value) || 0)}
							/>
							<span className="field-hint">Filtro adaptativo (0.05 rec.)</span>
						</div>

						<div className="field">
							<label htmlFor="pg-reppen">Repeat Penalty ({repeatPenalty.toFixed(2)})</label>
							<input
								id="pg-reppen"
								type="number"
								min={1}
								max={2}
								step={0.05}
								value={repeatPenalty}
								onChange={(e) => setRepeatPenalty(Number(e.target.value) || 1)}
							/>
							<span className="field-hint">Penalización de repetición</span>
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
							<span className="field-hint">Límite de respuesta</span>
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

					<div className="action-row" style={{ justifyContent: "space-between" }}>
						<label className="checkbox-label">
							<input
								type="checkbox"
								checked={jsonMode}
								onChange={(e) => setJsonMode(e.target.checked)}
							/>
							<span>Forzar salida JSON (`response_format: json_object`)</span>
						</label>

						<div className="field field-inline">
							<label htmlFor="pg-ds-target" className="small muted">
								Dataset destino:
							</label>
							<input
								id="pg-ds-target"
								type="text"
								className="input-sm"
								value={datasetTargetName}
								onChange={(e) => setDatasetTargetName(e.target.value)}
								placeholder="playground-curated"
							/>
						</div>
					</div>
				</section>
			) : null}

			{/* Studio Split Layout: Sessions List + Chat Viewport */}
			<div className="playground-studio-grid">
				<aside className="playground-sessions card" aria-label="Historial de sesiones">
					<div className="playground-sessions-head">
						<strong>Sesiones ({sessions.length})</strong>
						<Button size="sm" variant="primary" onClick={handleNewSession} disabled={streaming}>
							<IconPlus size={13} />
							<span>Nueva</span>
						</Button>
					</div>
					<ul className="playground-session-list">
						{sessions.map((s) => (
							<li
								key={s.id}
								className={`playground-session-item ${s.id === activeSession.id ? "active" : ""}`}
							>
								<button
									type="button"
									className="playground-session-btn"
									onClick={() => setActiveSessionId(s.id)}
								>
									<span className="playground-session-title">{s.title}</span>
									<span className="playground-session-meta muted small">
										{s.messages.length} msj · {s.model || "default"}
									</span>
								</button>
								<button
									type="button"
									className="icon-btn icon-btn-sm"
									onClick={() => handleDeleteSession(s.id)}
									title="Eliminar sesión"
									aria-label="Eliminar sesión"
								>
									<IconX size={13} />
								</button>
							</li>
						))}
					</ul>
				</aside>

				<div className="playground-chat card">
					<div className="playground-messages">
						{messages.length === 0 ? (
							<div className="playground-empty">
								<div className="playground-empty-icon">
									<IconPlayground size={32} />
								</div>
								<h3>Probá el motor en tiempo real</h3>
								<p className="muted">
									Enviá un mensaje, pegá una imagen (`Ctrl+V`) o elegí una plantilla rápida para
									medir la velocidad de{" "}
									<strong>{selectedModel || status?.loadedModel || "llama-server"}</strong>.
								</p>
								<div className="playground-presets">
									{PROMPT_PRESETS.map((p) => (
										<button
											key={p.label}
											type="button"
											className="preset-chip"
											onClick={() => void handleSend(p.prompt)}
										>
											<IconBolt size={13} />
											<span>{p.label}</span>
										</button>
									))}
								</div>
							</div>
						) : (
							messages.map((m, idx) => (
								<div key={m.id} className={`chat-bubble chat-bubble-${m.role}`}>
									<div className="chat-bubble-head">
										<span className="chat-role-badge">
											{m.role === "user" ? "Vos" : selectedModel || "Asistente"}
										</span>
										<div className="chat-bubble-meta">
											{m.tokPerSec ? (
												<span className="chat-speed-pill">
													<IconBolt size={12} />
													{m.tokPerSec.toFixed(1)} tok/s · {m.approxTokens} tok
													{m.ttftMs ? ` · TTFT ${m.ttftMs}ms` : ""} · {m.elapsedSec?.toFixed(1)}s
												</span>
											) : null}
											{m.role === "assistant" && idx === messages.length - 1 && !streaming ? (
												<button
													type="button"
													className="icon-btn icon-btn-sm"
													onClick={handleRegenerateLast}
													title="Regenerar respuesta"
													aria-label="Regenerar respuesta"
												>
													<IconRefresh size={13} />
												</button>
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
										{m.role === "assistant" ? (
											m.text || m.reasoningText ? (
												<MarkdownContent content={m.text} reasoningContent={m.reasoningText} />
											) : streaming ? (
												<span className="muted">Generando respuesta…</span>
											) : null
										) : (
											m.text
										)}
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
							placeholder="Escribí un mensaje o pegá una imagen (Ctrl+V)… (Enter para enviar, Shift+Enter para salto)"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onPaste={(e) => {
								const items = e.clipboardData?.items;
								if (!items) return;
								for (const item of items) {
									if (item.type.startsWith("image/")) {
										const file = item.getAsFile();
										if (file) {
											e.preventDefault();
											handleAttachImage(file);
											break;
										}
									}
								}
							}}
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
		</div>
	);
}
