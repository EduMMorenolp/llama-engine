import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchRuntimeLogs } from "../../api";
import { useToast } from "../../context/ToastContext";
import { useModels } from "../../hooks/useModels";
import { useRuntime } from "../../hooks/useRuntime";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { IconCopy, IconDownload, IconPlay, IconRefresh, IconStop, IconTerminal } from "../ui/Icons";
import { PageHeader, PageSection } from "../ui/PageHeader";
import { ErrorState, Loading } from "../ui/states";

const TAIL_OPTIONS = [50, 100, 200, 500];

const ENV_DESCRIPTIONS: Record<string, string> = {
	LLAMA_MODEL: "ID del modelo GGUF montado en /models",
	LLAMA_CTX_SIZE: "Tamaño total del KV cache compartido entre slots",
	LLAMA_NGPU: "Capas offloadadas a GPU (-1 o 999 = todas)",
	LLAMA_FLASH_ATTN: "Flash Attention en CUDA (reduce VRAM y acelera prefill)",
	LLAMA_CHAT_TEMPLATE: "Plantilla Jinja/chat de formateo (auto, gemma, chatml…)",
	LLAMA_MMPROJ: "Proyector multimodal de visión (auto o nombre de archivo)",
	LLAMA_CACHE_TYPE_K: "Tipo de cuantización para el cache K (f16, q8_0, q4_0)",
	LLAMA_CACHE_TYPE_V: "Tipo de cuantización para el cache V (f16, q8_0, q4_0)",
	LLAMA_PARALLEL: "Cantidad de slots paralelos en llama-server",
	LLAMA_THREADS: "Hilos de CPU durante generación de tokens",
	LLAMA_THREADS_BATCH: "Hilos de CPU durante prefill/batching",
	LLAMA_GPU_LAYERS: "Capas en GPU (-1 o 999 = todas las capas)",
	LLAMA_BATCH: "Tamaño de batch lógico de prefill (--batch-size)",
	LLAMA_UBATCH: "Tamaño de batch físico por pasada (--ubatch-size)",
	LLAMA_JINJA: "Habilita el motor Jinja para Tool Calling (--jinja)",
	LLAMA_ROPE_FREQ_BASE: "Frecuencia base RoPE para extensión de contexto",
	LLAMA_ROPE_FREQ_SCALE: "Factor de escala RoPE",
	LLAMA_REASONING_FORMAT: "Formato de extracción de pensamiento (deepseek/none)",
	LLAMA_LORA: "Adaptador LoRA GGUF montado en caliente (--lora)",
};

export function RuntimePage() {
	const toast = useToast();
	const { status, config, error, loading, refresh } = useRuntime();
	const master = useModels([], refresh);

	const [tail, setTail] = useState(100);
	const [logs, setLogs] = useState<string[]>([]);
	const [logsLoading, setLogsLoading] = useState(true);
	const [logsError, setLogsError] = useState<string | null>(null);
	const [logSearch, setLogSearch] = useState("");
	const [logLevel, setLogLevel] = useState<"all" | "warn" | "perf">("all");
	const [autoFollowLogs, setAutoFollowLogs] = useState(false);
	const [confirmAction, setConfirmAction] = useState<"restart" | "stop" | null>(null);

	const loadLogs = useCallback(async () => {
		try {
			const res = await fetchRuntimeLogs(tail);
			setLogs(res.lines);
			setLogsError(null);
		} catch (err) {
			setLogsError(err instanceof Error ? err.message : String(err));
		} finally {
			setLogsLoading(false);
		}
	}, [tail]);

	useEffect(() => {
		void loadLogs();
	}, [loadLogs]);

	useEffect(() => {
		if (!autoFollowLogs) return;
		const id = window.setInterval(() => {
			void loadLogs();
		}, 3000);
		return () => window.clearInterval(id);
	}, [autoFollowLogs, loadLogs]);

	const filteredLogs = useMemo(() => {
		const q = logSearch.trim().toLowerCase();
		return logs.filter((line) => {
			const lower = line.toLowerCase();
			if (logLevel === "warn" && !/(error|warn|fail|fatal|exception)/i.test(line)) {
				return false;
			}
			if (logLevel === "perf" && !/(tok\/s|eval time|slot|prompt|load_tensors)/i.test(line)) {
				return false;
			}
			if (q && !lower.includes(q)) return false;
			return true;
		});
	}, [logs, logSearch, logLevel]);

	if (loading) return <Loading />;
	if (error && !status) return <ErrorState error={error} onRetry={refresh} />;

	const engine = config?.engine;
	const envEntries = config?.runtimeEnv ? Object.entries(config.runtimeEnv) : [];
	const rEnv = config?.runtimeEnv ?? {};
	const reconstructedCmd = [
		"llama-server",
		`--model /models/${rEnv.LLAMA_MODEL || status?.loadedModel || "qwen3.5-4b"}.gguf`,
		`--ctx-size ${rEnv.LLAMA_CTX_SIZE || "32768"}`,
		`--n-gpu-layers ${rEnv.LLAMA_GPU_LAYERS || rEnv.LLAMA_NGPU || "-1"}`,
		`--flash-attn ${rEnv.LLAMA_FLASH_ATTN === "0" || rEnv.LLAMA_FLASH_ATTN === "off" ? "off" : "on"}`,
		...(rEnv.LLAMA_CACHE_TYPE_K ? [`--cache-type-k ${rEnv.LLAMA_CACHE_TYPE_K}`] : []),
		...(rEnv.LLAMA_CACHE_TYPE_V ? [`--cache-type-v ${rEnv.LLAMA_CACHE_TYPE_V}`] : []),
		...(rEnv.LLAMA_PARALLEL ? [`--parallel ${rEnv.LLAMA_PARALLEL}`] : []),
		...(rEnv.LLAMA_THREADS ? [`--threads ${rEnv.LLAMA_THREADS}`] : []),
		...(rEnv.LLAMA_BATCH ? [`--batch-size ${rEnv.LLAMA_BATCH}`] : []),
		...(rEnv.LLAMA_JINJA === "1" ? ["--jinja"] : []),
	].join(" ");

	const formatEngineValue = (val: unknown): string => {
		if (val && typeof val === "object") {
			const obj = val as Record<string, unknown>;
			if ("enabled" in obj) {
				return obj.enabled ? `Activo (máx ${obj.max} req)` : "Desactivado";
			}
			return JSON.stringify(val);
		}
		return String(val ?? "—");
	};

	const handleCopyLogs = async () => {
		try {
			await navigator.clipboard.writeText(filteredLogs.join("\n"));
			toast.success("Logs copiados", `${filteredLogs.length} líneas copiadas al portapapeles.`);
		} catch {
			toast.error("No se pudieron copiar los logs");
		}
	};

	const handleDownloadLogs = () => {
		const blob = new Blob([filteredLogs.join("\n")], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `llama-runtime-${Date.now()}.log`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="page-stack">
			<PageHeader
				title="Runtime & Diagnóstico"
				description="Configuración efectiva del motor, comando llama-server activo, variables LLAMA_* y consola de logs"
				badge={status?.runtimeRunning ? "Contenedor Activo" : "Detenido"}
			/>

			<div className="selected-model-banner">
				<IconTerminal size={16} className="accent-text" />
				<span className="mono small" style={{ flex: 1 }}>
					{reconstructedCmd}
				</span>
				<Button
					size="sm"
					variant="ghost"
					onClick={async () => {
						await navigator.clipboard.writeText(reconstructedCmd);
						toast.success("Comando llama-server copiado");
					}}
				>
					<IconCopy size={13} />
					<span>Copiar flag CLI</span>
				</Button>
			</div>

			<div className="grid grid-2">
				<PageSection title="Engine" subtitle="Parámetros del wrapper engine-api">
					{engine ? (
						<dl className="kv">
							{Object.entries(engine).map(([key, value]) => (
								<div key={key} className="kv-row">
									<dt>{key}</dt>
									<dd className="mono">{formatEngineValue(value)}</dd>
								</div>
							))}
						</dl>
					) : (
						<p className="muted">config no disponible</p>
					)}
				</PageSection>

				<PageSection title="runtimeEnv" subtitle="Variables LLAMA_* inyectadas al contenedor">
					{envEntries.length > 0 ? (
						<div className="table-scroll">
							<table className="table env-table">
								<thead>
									<tr>
										<th>Variable</th>
										<th>Valor</th>
									</tr>
								</thead>
								<tbody>
									{envEntries.map(([key, value]) => (
										<tr key={key}>
											<th scope="row">
												<div className="env-key-cell">
													<span className="mono">{key}</span>
													{ENV_DESCRIPTIONS[key] ? (
														<span className="env-key-desc muted">{ENV_DESCRIPTIONS[key]}</span>
													) : null}
												</div>
											</th>
											<td className="td-code">{value || <span className="muted">(vacío)</span>}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<p className="muted">sin variables</p>
					)}
				</PageSection>
			</div>

			<PageSection title="Controles" subtitle="Ciclo de vida del contenedor Docker llama-runtime">
				<div className="action-row">
					<Button
						variant="danger"
						busy={master.busyAction === "restart"}
						onClick={() => setConfirmAction("restart")}
					>
						<IconRefresh size={15} />
						<span>Reiniciar</span>
					</Button>
					<Button
						variant="danger"
						busy={master.busyAction === "stop"}
						onClick={() => setConfirmAction("stop")}
					>
						<IconStop size={15} />
						<span>Stop</span>
					</Button>
					<Button busy={master.busyAction === "start"} onClick={master.start}>
						<IconPlay size={15} />
						<span>Start</span>
					</Button>
				</div>
				{master.error ? (
					<p className="feedback feedback-error" role="status">
						{master.error}
					</p>
				) : null}
				{master.message ? (
					<p className="feedback feedback-ok" role="status">
						{master.message}
					</p>
				) : null}
			</PageSection>

			<PageSection
				title="Logs"
				subtitle={`Mostrando ${filteredLogs.length} de ${logs.length} líneas devueltas por el contenedor`}
				actions={
					<div className="action-row">
						<Button
							variant="ghost"
							size="sm"
							onClick={handleCopyLogs}
							disabled={filteredLogs.length === 0}
						>
							<IconCopy size={14} />
							<span>Copiar</span>
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleDownloadLogs}
							disabled={filteredLogs.length === 0}
						>
							<IconDownload size={14} />
							<span>Descargar .log</span>
						</Button>
					</div>
				}
			>
				<div className="log-controls">
					<div className="field field-narrow">
						<label htmlFor="log-tail">Líneas</label>
						<select id="log-tail" value={tail} onChange={(e) => setTail(Number(e.target.value))}>
							{TAIL_OPTIONS.map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</select>
					</div>

					<div className="field">
						<label htmlFor="log-filter">Buscar en logs</label>
						<input
							id="log-filter"
							type="search"
							placeholder="Filtrar por texto (ej. slot, tok/s, kv, error)…"
							value={logSearch}
							onChange={(e) => setLogSearch(e.target.value)}
						/>
					</div>

					<div className="field field-narrow">
						<label htmlFor="log-level">Filtro rápido</label>
						<select
							id="log-level"
							value={logLevel}
							onChange={(e) => setLogLevel(e.target.value as "all" | "warn" | "perf")}
						>
							<option value="all">Todas las líneas</option>
							<option value="perf">Rendimiento & Slots</option>
							<option value="warn">Errores & Warnings</option>
						</select>
					</div>

					<label className="checkbox-label" style={{ paddingBottom: 8 }}>
						<input
							type="checkbox"
							checked={autoFollowLogs}
							onChange={(e) => setAutoFollowLogs(e.target.checked)}
						/>
						<span>Auto-actualizar (3s)</span>
					</label>

					<Button variant="ghost" onClick={loadLogs} busy={logsLoading}>
						<IconRefresh size={14} />
						<span>Actualizar</span>
					</Button>
				</div>

				{logsError ? (
					<p className="feedback feedback-error" role="status">
						{logsError}
					</p>
				) : null}

				<div className="logs" role="log" aria-live="off" aria-busy={logsLoading || undefined}>
					<div className="logs-topbar">
						<IconTerminal size={14} />
						<span>docker logs --tail {tail} llama-runtime</span>
					</div>
					{logsLoading ? (
						<p className="muted">cargando logs…</p>
					) : filteredLogs.length === 0 ? (
						<p className="muted">sin líneas de log</p>
					) : (
						<pre>{filteredLogs.join("\n")}</pre>
					)}
				</div>
			</PageSection>

			<ConfirmDialog
				open={confirmAction !== null}
				title={confirmAction === "restart" ? "Reiniciar runtime" : "Detener runtime"}
				description={
					confirmAction === "restart"
						? "¿Reiniciar el contenedor llama-runtime ahora? Se interrumpirán las sesiones activas mientras recarga."
						: "¿Detener el contenedor llama-runtime? El servidor dejará de responder hasta que lo inicies nuevamente."
				}
				confirmLabel={confirmAction === "restart" ? "Reiniciar" : "Detener"}
				busy={master.busyAction === confirmAction}
				onCancel={() => setConfirmAction(null)}
				onConfirm={() => {
					const act = confirmAction;
					setConfirmAction(null);
					if (act === "restart") master.restart();
					if (act === "stop") master.stop();
				}}
			/>
		</div>
	);
}
