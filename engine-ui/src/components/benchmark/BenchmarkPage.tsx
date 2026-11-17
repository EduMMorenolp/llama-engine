import {
	BarElement,
	CategoryScale,
	Chart as ChartJS,
	Legend,
	LinearScale,
	Tooltip,
} from "chart.js";
import { useMemo, useRef, useState } from "react";
import { Bar } from "react-chartjs-2";
import { type ChatContentPart, type ChatMessagePayload, streamChatCompletion } from "../../api";
import { useToast } from "../../context/ToastContext";
import { useModels } from "../../hooks/useModels";
import { useRuntime } from "../../hooks/useRuntime";
import { Button } from "../ui/Button";
import { fmtTime } from "../ui/helpers";
import {
	IconAlert,
	IconBolt,
	IconCheck,
	IconCopy,
	IconCpu,
	IconDownload,
	IconEye,
	IconGauge,
	IconPlay,
	IconStop,
	IconTrash,
	IconTrophy,
} from "../ui/Icons";
import { MarkdownContent } from "../ui/MarkdownContent";
import { PageHeader, PageSection } from "../ui/PageHeader";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export type TestCategory =
	| "speed"
	| "reasoning"
	| "coding"
	| "json"
	| "context"
	| "vision"
	| "custom";

export interface BenchmarkTestCase {
	id: string;
	category: TestCategory;
	title: string;
	description: string;
	prompt: string;
	systemPrompt?: string;
	maxTokens: number;
	temperature: number;
	jsonMode?: boolean;
	requiresVision?: boolean;
	validator?: (output: string) => { passed: boolean; note: string };
}

export interface SingleTestResult {
	testId: string;
	title: string;
	category: TestCategory;
	passed: boolean;
	note: string;
	ttftMs: number;
	tokPerSec: number;
	elapsedSec: number;
	tokensGenerated: number;
	outputPreview: string;
}

export interface BenchmarkRunRecord {
	id: string;
	timestamp: number;
	modelId: string;
	ctxSize?: number;
	cacheTypeK?: string;
	cacheTypeV?: string;
	parallel?: string;
	gpuName?: string;
	vramUsedMiB?: number;
	tempPeakC?: number;
	powerW?: number;
	avgTokPerSec: number;
	avgTtftMs: number;
	passRatePct: number;
	score: number;
	grade: "S" | "A" | "B" | "C";
	results: SingleTestResult[];
}

const STORAGE_KEY = "llama-engine-benchmarks";

function createTestVisionDataUrl(): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="140" viewBox="0 0 320 140">
		<rect width="320" height="140" fill="#0f172a"/>
		<rect x="16" y="16" width="288" height="108" rx="12" fill="#1e293b" stroke="#34d399" stroke-width="3"/>
		<circle cx="64" cy="70" r="26" fill="#34d399"/>
		<text x="112" y="64" fill="#f8fafc" font-family="monospace" font-size="22" font-weight="bold">LLAMA-2026</text>
		<text x="112" y="94" fill="#94a3b8" font-family="sans-serif" font-size="15">GPU OK - 42 TOK/S</text>
	</svg>`;
	return `data:image/svg+xml;base64,${window.btoa(svg)}`;
}

function buildLongContextPrompt(approxWords: number): string {
	const filler =
		"En arquitecturas de inferencia local sobre CUDA, el KV cache almacena los tensores de claves y valores de atención para cada capa del transformer. ";
	const repeats = Math.max(4, Math.floor(approxWords / 20));
	const hayStack = Array.from({ length: repeats }, (_, i) => `[Bloque ${i + 1}] ${filler}`).join(
		"\n",
	);
	return `${hayStack}\n\nDATO CLAVE OCULTO: El código maestro del reactor Blackwell es "OMEGA-7749".\n${hayStack}\n\nPregunta: Según el texto anterior, ¿cuál es exactamente el código maestro del reactor Blackwell? Respondé en una sola oración que incluya el código exacto.`;
}

const TEST_SUITE: BenchmarkTestCase[] = [
	{
		id: "speed-throughput",
		category: "speed",
		title: "Velocidad & Throughput Puro",
		description:
			"Mide latencia al primer token (TTFT) y velocidad sostenida de generación (tok/s).",
		systemPrompt: "Sos un ingeniero de sistemas conciso y técnico.",
		prompt:
			"Explicá en 5 puntos claros cómo funcionan los Tensor Cores en una GPU NVIDIA, qué diferencia hay entre FP16, Q8_0 y Q4_K_M, y cómo impacta el ancho de banda de memoria en los tokens por segundo.",
		maxTokens: 320,
		temperature: 0.3,
		validator: (out) => {
			const words = out.trim().split(/\s+/).length;
			return {
				passed: words >= 40,
				note: `${words} palabras generadas con fluidez`,
			};
		},
	},
	{
		id: "reasoning-math",
		category: "reasoning",
		title: "Razonamiento Lógico y Matemático",
		description:
			"Verifica deducción paso a paso con trampa aritmética clásica y precisión del resultado final.",
		systemPrompt: "Resolvé paso a paso y al final escribí el número exacto.",
		prompt:
			"Un servidor procesa 40 peticiones por minuto durante 3 minutos. Luego duplica su velocidad durante los siguientes 2 minutos. Sin embargo, el 10% del total de peticiones fallaron por timeout. ¿Cuántas peticiones fueron exitosas en total? Mostrá el cálculo.",
		maxTokens: 320,
		temperature: 0.1,
		validator: (out) => {
			// 40*3 = 120; 80*2 = 160; total = 280; 90% de 280 = 252
			const clean = out.replace(/<\/?think>/g, "");
			const ok = /\b252\b/.test(clean);
			return {
				passed: ok,
				note: ok
					? "Resultado exacto (252) verificado"
					: "No se encontró el resultado esperado (252)",
			};
		},
	},
	{
		id: "coding-ts",
		category: "coding",
		title: "Generación de Código TypeScript",
		description: "Evalúa sintaxis, tipado estricto e inclusión de bloques de código estructurados.",
		systemPrompt: "Devolvé código TypeScript limpio dentro de un bloque ```typescript.",
		prompt:
			"Escribí una función en TypeScript llamada ` parseGpuCsv(line: string) ` que reciba una línea CSV con `name,totalMiB,usedMiB` y devuelva un objeto tipado `{ name: string; usagePct: number }` redondeado a 1 decimal.",
		maxTokens: 320,
		temperature: 0.2,
		validator: (out) => {
			const hasFn = /parseGpuCsv/.test(out);
			const hasTypes = /usagePct|string|number/.test(out);
			const passed = hasFn && hasTypes;
			return {
				passed,
				note: passed
					? "Función y tipos TypeScript presentes"
					: "Falta firma `parseGpuCsv` o tipado",
			};
		},
	},
	{
		id: "json-strict",
		category: "json",
		title: "Adherencia a JSON Estricto",
		description: "Comprueba si el modelo devuelve un objeto JSON parseable con las claves pedidas.",
		systemPrompt:
			"Respondé ÚNICAMENTE con un objeto JSON válido, sin bloques markdown ni texto adicional.",
		prompt:
			'Devolvé un JSON con exactamente estas claves: `{"engine": "llama.cpp", "cuda": true, "recommendedQuants": ["Q4_K_M", "Q8_0"], "maxSlots": 4}`.',
		maxTokens: 180,
		temperature: 0.1,
		jsonMode: true,
		validator: (out) => {
			const cleaned = out
				.replace(/<think>[\s\S]*?<\/think>/g, "")
				.replace(/```json|```/g, "")
				.trim();
			try {
				const parsed = JSON.parse(cleaned) as Record<string, unknown>;
				const hasKeys =
					"engine" in parsed && "cuda" in parsed && Array.isArray(parsed.recommendedQuants);
				return {
					passed: hasKeys,
					note: hasKeys ? "JSON válido y esquema verificado" : "JSON válido pero faltan claves",
				};
			} catch {
				return { passed: false, note: "Falló JSON.parse() sobre la salida" };
			}
		},
	},
	{
		id: "context-needle",
		category: "context",
		title: "Stress Test de Contexto (Needle in a Haystack)",
		description:
			"Envía un prompt largo con ruido técnico y verifica recuperación exacta + velocidad de prefill.",
		systemPrompt: "Respondé únicamente basándote en el contexto provisto.",
		prompt: buildLongContextPrompt(900),
		maxTokens: 140,
		temperature: 0.1,
		validator: (out) => {
			const ok = /OMEGA-7749/i.test(out);
			return {
				passed: ok,
				note: ok
					? 'Aguja encontrada ("OMEGA-7749") en contexto largo'
					: 'No recuperó el código "OMEGA-7749"',
			};
		},
	},
];

function computeScoreAndGrade(
	avgTokPerSec: number,
	avgTtftMs: number,
	passRatePct: number,
): { score: number; grade: "S" | "A" | "B" | "C" } {
	// Speed up to 50 pts (50+ tok/s = full 50 pts)
	const speedScore = Math.min(50, (avgTokPerSec / 48) * 50);
	// Latency up to 15 pts (<300ms = 15 pts, >2500ms = 2 pts)
	const latencyScore = Math.max(2, Math.min(15, 15 - Math.max(0, avgTtftMs - 250) / 180));
	// Accuracy up to 35 pts
	const accuracyScore = (passRatePct / 100) * 35;

	const score = Math.round(Math.min(100, speedScore + latencyScore + accuracyScore));
	const grade = score >= 88 ? "S" : score >= 74 ? "A" : score >= 55 ? "B" : "C";
	return { score, grade };
}

export function BenchmarkPage() {
	const toast = useToast();
	const { status, health, config, refresh } = useRuntime();
	const modelActions = useModels(status?.models ?? [], refresh);

	const registry = status?.models ?? [];
	const [selectedModel, setSelectedModel] = useState(() => status?.loadedModel || "");
	const [selectedTests, setSelectedTests] = useState<Record<string, boolean>>(() => {
		const init: Record<string, boolean> = {};
		for (const t of TEST_SUITE) init[t.id] = true;
		return init;
	});

	// Custom prompt test
	const [customPrompt, setCustomPrompt] = useState(
		"Explicá en 3 párrafos cómo optimizar el uso de VRAM en modelos GGUF de 7B a 9B parámetros.",
	);
	const [customRuns, setCustomRuns] = useState(1);
	const [includeCustom, setIncludeCustom] = useState(false);

	// Running state
	const [running, setRunning] = useState(false);
	const [currentTestTitle, setCurrentTestTitle] = useState<string | null>(null);
	const [liveOutput, setLiveOutput] = useState("");
	const [liveReasoning, setLiveReasoning] = useState("");
	const [liveResults, setLiveResults] = useState<SingleTestResult[]>([]);
	const abortRef = useRef<AbortController | null>(null);

	// Saved leaderboard
	const [history, setHistory] = useState<BenchmarkRunRecord[]>(() => {
		try {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			return raw ? (JSON.parse(raw) as BenchmarkRunRecord[]) : [];
		} catch {
			return [];
		}
	});

	const activeModel = selectedModel || status?.loadedModel || "";
	const isLoaded = Boolean(activeModel && activeModel === status?.loadedModel);
	const modelObj = registry.find((m) => m.id === activeModel);

	const saveRunToHistory = (record: BenchmarkRunRecord) => {
		setHistory((prev) => {
			const next = [record, ...prev].slice(0, 30);
			try {
				window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			} catch {}
			return next;
		});
	};

	const executeTestList = async (cases: BenchmarkTestCase[]) => {
		if (!activeModel) {
			toast.warning("Sin modelo", "Seleccioná o cargá un modelo antes de iniciar el test.");
			return;
		}
		setRunning(true);
		setLiveResults([]);
		setLiveOutput("");
		setLiveReasoning("");

		const ctrl = new AbortController();
		abortRef.current = ctrl;
		const collected: SingleTestResult[] = [];
		let peakTemp = status?.gpu.temperatureC ?? 0;

		try {
			for (const tc of cases) {
				if (ctrl.signal.aborted) break;
				setCurrentTestTitle(tc.title);
				setLiveOutput("");
				setLiveReasoning("");

				let fullText = "";
				let fullReasoning = "";

				const messages: ChatMessagePayload[] = [];
				if (tc.systemPrompt) {
					messages.push({ role: "system", content: tc.systemPrompt });
				}
				if (tc.requiresVision && modelObj?.vision) {
					const parts: ChatContentPart[] = [
						{ type: "text", text: tc.prompt },
						{ type: "image_url", image_url: { url: createTestVisionDataUrl() } },
					];
					messages.push({ role: "user", content: parts });
				} else {
					messages.push({ role: "user", content: tc.prompt });
				}

				const stats = await streamChatCompletion({
					model: activeModel,
					messages,
					temperature: tc.temperature,
					maxTokens: tc.maxTokens,
					jsonMode: tc.jsonMode,
					signal: ctrl.signal,
					onToken: (delta, rDelta) => {
						if (delta) fullText += delta;
						if (rDelta) fullReasoning += rDelta;
						setLiveOutput(fullText);
						setLiveReasoning(fullReasoning);
					},
				});

				if (status?.gpu.temperatureC && status.gpu.temperatureC > peakTemp) {
					peakTemp = status.gpu.temperatureC;
				}

				const validation = tc.validator
					? tc.validator(fullText)
					: { passed: fullText.trim().length > 10, note: "Respuesta completada" };

				const single: SingleTestResult = {
					testId: tc.id,
					title: tc.title,
					category: tc.category,
					passed: validation.passed,
					note: validation.note,
					ttftMs: stats.ttftMs,
					tokPerSec: Number(stats.tokPerSec.toFixed(1)),
					elapsedSec: Number(stats.elapsedSec.toFixed(2)),
					tokensGenerated: stats.chunksCount,
					outputPreview: fullText.slice(0, 260),
				};

				collected.push(single);
				setLiveResults([...collected]);
			}

			if (collected.length > 0 && !ctrl.signal.aborted) {
				const avgTokPerSec = Number(
					(collected.reduce((a, r) => a + r.tokPerSec, 0) / collected.length).toFixed(1),
				);
				const avgTtftMs = Math.round(
					collected.reduce((a, r) => a + r.ttftMs, 0) / collected.length,
				);
				const passedCount = collected.filter((r) => r.passed).length;
				const passRatePct = Math.round((passedCount / collected.length) * 100);
				const { score, grade } = computeScoreAndGrade(avgTokPerSec, avgTtftMs, passRatePct);

				const record: BenchmarkRunRecord = {
					id: `bench-${Date.now()}`,
					timestamp: Date.now(),
					modelId: activeModel,
					ctxSize: health?.ctxSize ?? status?.ctxSize,
					cacheTypeK: config?.runtimeEnv?.LLAMA_CACHE_TYPE_K || "f16",
					cacheTypeV: config?.runtimeEnv?.LLAMA_CACHE_TYPE_V || "f16",
					parallel: config?.runtimeEnv?.LLAMA_PARALLEL || "1",
					gpuName: status?.gpu.name,
					vramUsedMiB: status?.gpu.vramUsedMiB,
					tempPeakC: peakTemp || status?.gpu.temperatureC,
					powerW: status?.gpu.powerDrawW,
					avgTokPerSec,
					avgTtftMs,
					passRatePct,
					score,
					grade,
					results: collected,
				};
				saveRunToHistory(record);
				toast.success(
					`Benchmark finalizado · Calificación ${grade} (${score}/100)`,
					`Promedio: ${avgTokPerSec} tok/s · TTFT: ${avgTtftMs} ms · ${passedCount}/${collected.length} pruebas OK`,
				);
			}
		} catch (err) {
			if ((err as { name?: string })?.name === "AbortError") {
				toast.info("Test cancelado", "Se detuvo la ejecución de la batería de pruebas.");
			} else {
				const msg = err instanceof Error ? err.message : String(err);
				toast.error("Error durante el test", msg);
			}
		} finally {
			setRunning(false);
			setCurrentTestTitle(null);
			abortRef.current = null;
			refresh();
		}
	};

	const handleRunSelectedSuite = () => {
		const list: BenchmarkTestCase[] = TEST_SUITE.filter((t) => selectedTests[t.id]);
		if (includeCustom && customPrompt.trim()) {
			const runs = Math.max(1, Math.min(5, customRuns));
			for (let i = 1; i <= runs; i++) {
				list.push({
					id: `custom-${i}`,
					category: "custom",
					title: runs > 1 ? `Prompt Personalizado (Pasada #${i}/${runs})` : "Prompt Personalizado",
					description: "Prueba definida por el usuario",
					prompt: customPrompt.trim(),
					maxTokens: 320,
					temperature: 0.4,
				});
			}
		}
		if (list.length === 0) {
			toast.warning(
				"Seleccioná al menos una prueba",
				"Marcá las casillas de las pruebas a correr.",
			);
			return;
		}
		void executeTestList(list);
	};

	const handleRunQuickSpeed = () => {
		void executeTestList([TEST_SUITE[0]]);
	};

	const handleStop = () => {
		abortRef.current?.abort();
	};

	const handleClearHistory = () => {
		setHistory([]);
		try {
			window.localStorage.removeItem(STORAGE_KEY);
		} catch {}
		toast.info("Historial de benchmarks limpiado");
	};

	const handleExportMarkdown = (run: BenchmarkRunRecord) => {
		const lines = [
			`# Reporte de Benchmark — ${run.modelId}`,
			``,
			`- **Fecha**: ${new Date(run.timestamp).toLocaleString()}`,
			`- **Modelo**: \`${run.modelId}\``,
			`- **Calificación**: **${run.grade}** (${run.score}/100)`,
			`- **Velocidad Promedio**: **${run.avgTokPerSec} tok/s**`,
			`- **Latencia Primer Token (TTFT)**: **${run.avgTtftMs} ms**`,
			`- **Pruebas Superadas**: ${run.passRatePct}%`,
			`- **Configuración Runtime**: ctx=${run.ctxSize ?? "auto"}, KV=${run.cacheTypeK}/${run.cacheTypeV}, slots=${run.parallel}`,
			`- **GPU**: ${run.gpuName ?? "NVIDIA"} · VRAM usada: ${run.vramUsedMiB ?? "—"} MiB · Temp pico: ${run.tempPeakC ?? "—"}°C · Potencia: ${run.powerW ?? "—"} W`,
			``,
			`## Detalle por Prueba`,
			``,
			`| Prueba | Estado | Velocidad (tok/s) | TTFT (ms) | Tokens | Tiempo (s) | Observación |`,
			`|--------|--------|-------------------|-----------|--------|------------|-------------|`,
			...run.results.map(
				(r) =>
					`| ${r.title} | ${r.passed ? "PASS" : "FAIL"} | ${r.tokPerSec} | ${r.ttftMs} | ${r.tokensGenerated} | ${r.elapsedSec}s | ${r.note} |`,
			),
		];
		const md = lines.join("\n");
		const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `benchmark-${run.modelId}-${run.timestamp}.md`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success("Reporte Markdown descargado");
	};

	const latestRun = history[0] ?? null;

	const comparisonChartData = useMemo(() => {
		const recent = history.slice(0, 8).reverse();
		return {
			labels: recent.map((r) => `${r.modelId} (${r.cacheTypeK || "f16"})`),
			datasets: [
				{
					label: "Velocidad Promedio (tok/s)",
					data: recent.map((r) => r.avgTokPerSec),
					backgroundColor: "rgba(52, 211, 153, 0.72)",
					borderColor: "#34d399",
					borderWidth: 1.5,
					borderRadius: 6,
				},
				{
					label: "Score Global (0-100)",
					data: recent.map((r) => r.score),
					backgroundColor: "rgba(96, 165, 250, 0.55)",
					borderColor: "#60a5fa",
					borderWidth: 1.5,
					borderRadius: 6,
				},
			],
		};
	}, [history]);

	return (
		<div className="page-stack">
			<PageHeader
				title="Test & Benchmark del Modelo"
				description="Evaluá cómo rinde el modelo cargado en velocidad (TTFT, tok/s), estrés de contexto, razonamiento, código y JSON estricto"
				badge={status?.loadedModel ? `En GPU: ${status.loadedModel}` : "Sin modelo en GPU"}
				actions={
					<div className="action-row">
						{running ? (
							<Button variant="danger" onClick={handleStop}>
								<IconStop size={15} />
								<span>Detener Test</span>
							</Button>
						) : (
							<>
								<Button variant="ghost" onClick={handleRunQuickSpeed} disabled={!activeModel}>
									<IconBolt size={15} />
									<span>Test Rápido de Velocidad</span>
								</Button>
								<Button variant="primary" onClick={handleRunSelectedSuite} disabled={!activeModel}>
									<IconPlay size={15} />
									<span>Ejecutar Suite Seleccionada</span>
								</Button>
							</>
						)}
					</div>
				}
			/>

			{/* Selector de modelo objetivo + Estado de VRAM */}
			<div className="playground-toolbar card">
				<div className="playground-toolbar-left">
					<div className="field field-inline">
						<label htmlFor="bench-model">Modelo a evaluar</label>
						<select
							id="bench-model"
							value={activeModel}
							onChange={(e) => setSelectedModel(e.target.value)}
							disabled={running}
						>
							{registry.length === 0 ? (
								<option value="">{status?.loadedModel || "Sin modelos registrados"}</option>
							) : (
								registry.map((m) => (
									<option key={m.id} value={m.id}>
										{m.id} {m.vision ? "(Visión)" : "(Texto)"}{" "}
										{m.id === status?.loadedModel ? "· [Cargado en VRAM]" : ""}
									</option>
								))
							)}
						</select>
					</div>

					{activeModel && !isLoaded ? (
						<Button
							size="sm"
							variant="primary"
							busy={modelActions.busyAction === "reload"}
							onClick={() => modelActions.reload(activeModel)}
						>
							<IconCpu size={14} />
							<span>Cargar {activeModel} en VRAM antes de testear</span>
						</Button>
					) : null}
				</div>

				<div className="playground-toolbar-right">
					{status?.gpu.available ? (
						<span className="badge badge-muted">
							{status.gpu.name} · VRAM {status.gpu.vramUsedMiB}/{status.gpu.vramTotalMiB} MiB ·{" "}
							{status.gpu.temperatureC ?? "—"}°C
						</span>
					) : null}
					{health?.ctxSize ? (
						<span className="badge badge-on">Contexto: {health.ctxSize.toLocaleString()} tok</span>
					) : null}
				</div>
			</div>

			{/* Resumen KPI de la última corrida */}
			{latestRun ? (
				<div className="metric-tiles">
					<div className="metric-tile">
						<div className="metric-tile-top">
							<span className="metric-label">Calificación Global</span>
							<IconTrophy size={16} className="accent-text" />
						</div>
						<span className="metric-value">
							{latestRun.grade} <small>({latestRun.score}/100 pts)</small>
						</span>
						<span className="metric-sub mono">{latestRun.modelId}</span>
					</div>

					<div className="metric-tile">
						<div className="metric-tile-top">
							<span className="metric-label">Velocidad Generación</span>
							<IconBolt size={16} className="accent-text" />
						</div>
						<span className="metric-value">
							{latestRun.avgTokPerSec} <small>tok/s</small>
						</span>
						<span className="metric-sub">Promedio de la batería</span>
					</div>

					<div className="metric-tile">
						<div className="metric-tile-top">
							<span className="metric-label">Latencia Primer Token (TTFT)</span>
							<IconGauge size={16} className="muted" />
						</div>
						<span className="metric-value">
							{latestRun.avgTtftMs} <small>ms</small>
						</span>
						<span className="metric-sub">Tiempo de respuesta inicial</span>
					</div>

					<div className="metric-tile">
						<div className="metric-tile-top">
							<span className="metric-label">Precisión / Pass Rate</span>
							<IconCheck size={16} className="accent-text" />
						</div>
						<span className="metric-value">{latestRun.passRatePct}%</span>
						<span className="metric-sub">
							{latestRun.results.filter((r) => r.passed).length} de {latestRun.results.length}{" "}
							pruebas superadas
						</span>
					</div>

					<div className="metric-tile">
						<div className="metric-tile-top">
							<span className="metric-label">Eficiencia & Térmica</span>
							<IconCpu size={16} className="muted" />
						</div>
						<span className="metric-value">
							{latestRun.tempPeakC ? `${latestRun.tempPeakC}°C` : "—"}
							<small>{latestRun.powerW ? ` · ${latestRun.powerW.toFixed(0)}W` : ""}</small>
						</span>
						<span className="metric-sub">
							{latestRun.powerW && latestRun.powerW > 0
								? `${(latestRun.avgTokPerSec / latestRun.powerW).toFixed(2)} tok/s por Watt`
								: `VRAM: ${latestRun.vramUsedMiB ?? "—"} MiB`}
						</span>
					</div>
				</div>
			) : null}

			{/* Panel en Vivo cuando está ejecutando */}
			{running || liveResults.length > 0 ? (
				<PageSection
					title={
						running
							? `Ejecutando: ${currentTestTitle ?? "Test…"}`
							: "Resultados de la Ejecución Reciente"
					}
					subtitle="Monitoreo token a token y validación automática de cada prueba"
					actions={
						latestRun && !running ? (
							<Button variant="ghost" size="sm" onClick={() => handleExportMarkdown(latestRun)}>
								<IconDownload size={14} />
								<span>Exportar Reporte .md</span>
							</Button>
						) : undefined
					}
				>
					{running ? (
						<div className="bench-live-stream">
							<div className="bench-live-header">
								<span className="spinner" aria-hidden="true" />
								<strong>{currentTestTitle}</strong>
								<span className="muted small">
									Recibiendo stream SSE desde /v1/chat/completions…
								</span>
							</div>
							<div className="bench-live-output">
								<MarkdownContent
									content={liveOutput || "Esperando primer token…"}
									reasoningContent={liveReasoning}
								/>
							</div>
						</div>
					) : null}

					{liveResults.length > 0 ? (
						<div className="table-scroll">
							<table className="table">
								<thead>
									<tr>
										<th>Prueba</th>
										<th>Estado</th>
										<th className="num">Velocidad</th>
										<th className="num">TTFT</th>
										<th className="num">Tokens</th>
										<th className="num">Tiempo</th>
										<th>Validación / Extracto</th>
									</tr>
								</thead>
								<tbody>
									{liveResults.map((r) => (
										<tr key={r.testId}>
											<td>
												<strong>{r.title}</strong>
											</td>
											<td>
												<span className={`badge ${r.passed ? "badge-on" : "badge-warn"}`}>
													{r.passed ? (
														<>
															<IconCheck size={12} /> PASS
														</>
													) : (
														<>
															<IconAlert size={12} /> OBS
														</>
													)}
												</span>
											</td>
											<td className="num">
												<span className="badge badge-on mono">{r.tokPerSec} tok/s</span>
											</td>
											<td className="num mono">{r.ttftMs} ms</td>
											<td className="num mono">{r.tokensGenerated}</td>
											<td className="num mono">{r.elapsedSec}s</td>
											<td>
												<div className="bench-note-cell">
													<span>{r.note}</span>
													<small className="muted">{r.outputPreview.slice(0, 110)}…</small>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : null}
				</PageSection>
			) : null}

			{/* Configuración de la Batería de Pruebas */}
			<div className="grid grid-2">
				<PageSection
					title="Batería de Pruebas Estándar"
					subtitle="Seleccioná qué capacidades querés medir en el modelo cargado"
				>
					<div className="bench-cases-list">
						{TEST_SUITE.map((tc) => {
							const checked = Boolean(selectedTests[tc.id]);
							return (
								<div key={tc.id} className={`bench-case-card ${checked ? "active" : ""}`}>
									<label className="bench-case-head">
										<input
											type="checkbox"
											checked={checked}
											disabled={running}
											onChange={(e) =>
												setSelectedTests((prev) => ({ ...prev, [tc.id]: e.target.checked }))
											}
										/>
										<div className="bench-case-info">
											<div className="bench-case-title-row">
												<strong>{tc.title}</strong>
												<span className="badge badge-muted">{tc.category}</span>
											</div>
											<p className="muted small">{tc.description}</p>
										</div>
									</label>
									<Button
										size="sm"
										variant="ghost"
										disabled={running || !activeModel}
										onClick={() => void executeTestList([tc])}
									>
										<IconPlay size={12} />
										<span>Probar solo este</span>
									</Button>
								</div>
							);
						})}
					</div>
				</PageSection>

				<PageSection
					title="Test Personalizado & Multi-Pasada (N-Runs)"
					subtitle="Probá tu propio prompt de producción y repetilo N veces para medir consistencia"
				>
					<div className="settings-stack">
						<label className="checkbox-label">
							<input
								type="checkbox"
								checked={includeCustom}
								disabled={running}
								onChange={(e) => setIncludeCustom(e.target.checked)}
							/>
							<span>Incluir este prompt personalizado al ejecutar la suite</span>
						</label>

						<div className="field">
							<label htmlFor="custom-bench-prompt">Prompt de Prueba</label>
							<textarea
								id="custom-bench-prompt"
								rows={4}
								value={customPrompt}
								disabled={running}
								onChange={(e) => setCustomPrompt(e.target.value)}
							/>
						</div>

						<div className="field field-narrow">
							<label htmlFor="custom-bench-runs">Cantidad de Repeticiones (1 a 5)</label>
							<input
								id="custom-bench-runs"
								type="number"
								min={1}
								max={5}
								value={customRuns}
								disabled={running}
								onChange={(e) => setCustomRuns(Number(e.target.value) || 1)}
							/>
						</div>

						{modelObj?.vision ? (
							<div className="selected-model-banner">
								<IconEye size={16} className="accent-text" />
								<span>
									<strong>{activeModel}</strong> soporta Visión (`mmproj`). Podés lanzar un test
									multimodal sintético:
								</span>
								<Button
									size="sm"
									disabled={running}
									onClick={() =>
										void executeTestList([
											{
												id: "vision-ocr",
												category: "vision",
												title: "Lectura Visual Multimodal (mmproj)",
												description: "Genera una tarjeta gráfica SVG/Base64 y evalúa lectura OCR",
												prompt:
													"Describí qué texto y colores aparecen en esta imagen de diagnóstico.",
												maxTokens: 200,
												temperature: 0.2,
												requiresVision: true,
												validator: (out) => ({
													passed: /LLAMA|2026|42|GPU/i.test(out),
													note: "Reconocimiento visual completado",
												}),
											},
										])
									}
								>
									Probar Visión
								</Button>
							</div>
						) : null}

						<div className="action-row">
							<Button
								variant="primary"
								disabled={running || !customPrompt.trim() || !activeModel}
								onClick={() => {
									const runs = Math.max(1, Math.min(5, customRuns));
									const list: BenchmarkTestCase[] = Array.from({ length: runs }, (_, i) => ({
										id: `custom-direct-${i + 1}`,
										category: "custom",
										title:
											runs > 1
												? `Prompt Personalizado (Pasada #${i + 1}/${runs})`
												: "Prompt Personalizado",
										description: "Prueba personalizada directa",
										prompt: customPrompt.trim(),
										maxTokens: 320,
										temperature: 0.4,
									}));
									void executeTestList(list);
								}}
							>
								<IconBolt size={14} />
								<span>Ejecutar Prompt Personalizado ({customRuns}x)</span>
							</Button>
						</div>
					</div>
				</PageSection>
			</div>

			{/* Leaderboard Comparativo entre Modelos */}
			<PageSection
				title={`Leaderboard & Comparativa Histórica (${history.length})`}
				subtitle="Compará cómo rinden distintos modelos GGUF, cuantizaciones de KV Cache y tamaños de contexto en tu GPU"
				actions={
					history.length > 0 ? (
						<div className="action-row">
							{latestRun ? (
								<Button variant="ghost" size="sm" onClick={() => handleExportMarkdown(latestRun)}>
									<IconDownload size={14} />
									<span>Descargar último (.md)</span>
								</Button>
							) : null}
							<Button variant="ghost" size="sm" onClick={handleClearHistory}>
								<IconTrash size={14} />
								<span>Limpiar historial</span>
							</Button>
						</div>
					) : undefined
				}
			>
				{history.length === 0 ? (
					<p className="muted">
						Todavía no ejecutaste ningún benchmark. Pulsá{" "}
						<strong>"Ejecutar Suite Seleccionada"</strong> o{" "}
						<strong>"Test Rápido de Velocidad"</strong> arriba para registrar tu primera marca.
					</p>
				) : (
					<>
						{history.length > 1 ? (
							<div className="chart-wrap" style={{ marginBottom: "1rem" }}>
								<Bar
									data={comparisonChartData}
									options={{
										responsive: true,
										maintainAspectRatio: false,
										scales: {
											x: { ticks: { color: "#8b93a7" } },
											y: { beginAtZero: true, ticks: { color: "#8b93a7" } },
										},
										plugins: {
											legend: { labels: { color: "#8b93a7" } },
										},
									}}
								/>
							</div>
						) : null}

						<div className="table-scroll">
							<table className="table">
								<thead>
									<tr>
										<th>Fecha</th>
										<th>Modelo</th>
										<th>Config KV / Ctx</th>
										<th className="num">Calificación</th>
										<th className="num">Gen Speed</th>
										<th className="num">TTFT</th>
										<th className="num">Pass Rate</th>
										<th className="num">VRAM / Temp</th>
										<th className="td-actions">Reporte</th>
									</tr>
								</thead>
								<tbody>
									{history.map((run) => (
										<tr key={run.id}>
											<td className="muted small">{fmtTime(run.timestamp)}</td>
											<td className="mono">
												<strong>{run.modelId}</strong>
											</td>
											<td className="mono small muted">
												{run.ctxSize ? `${Math.round(run.ctxSize / 1024)}K` : "auto"} ·{" "}
												{run.cacheTypeK}/{run.cacheTypeV} · {run.parallel} slot(s)
											</td>
											<td className="num">
												<span className="badge badge-on mono">
													{run.grade} ({run.score})
												</span>
											</td>
											<td className="num mono">
												<strong>{run.avgTokPerSec} tok/s</strong>
											</td>
											<td className="num mono">{run.avgTtftMs} ms</td>
											<td className="num mono">{run.passRatePct}%</td>
											<td className="num muted small">
												{run.vramUsedMiB ? `${run.vramUsedMiB} MiB` : "—"}
												{run.tempPeakC ? ` · ${run.tempPeakC}°C` : ""}
											</td>
											<td className="td-actions">
												<div className="row-actions">
													<Button
														size="sm"
														variant="ghost"
														onClick={() => handleExportMarkdown(run)}
														title="Descargar reporte Markdown"
													>
														<IconDownload size={13} />
														<span>.md</span>
													</Button>
													<Button
														size="sm"
														variant="ghost"
														onClick={async () => {
															await navigator.clipboard.writeText(
																`${run.modelId}: ${run.avgTokPerSec} tok/s (TTFT ${run.avgTtftMs}ms, Score ${run.score}/100, Pass ${run.passRatePct}%)`,
															);
															toast.success("Resumen copiado");
														}}
														title="Copiar resumen"
													>
														<IconCopy size={13} />
													</Button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</>
				)}
			</PageSection>
		</div>
	);
}
