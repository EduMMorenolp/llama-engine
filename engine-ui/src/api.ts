export interface GpuInfo {
	available: boolean;
	name?: string;
	vramTotalMiB?: number;
	vramUsedMiB?: number;
	vramFreeMiB?: number;
	gpuUtilPct?: number;
	temperatureC?: number;
	powerDrawW?: number;
}

export interface SlotInfo {
	id: number;
	model: string;
	promptN: number;
	predictedN: number;
	promptPerSec: number;
	predictedPerSec: number;
	totalPerSec?: number;
}

export interface ReloadOptions {
	ctxSize?: number;
	cacheTypeK?: "f16" | "q8_0" | "q4_0" | "q4_1" | "q5_0" | "q5_1";
	cacheTypeV?: "f16" | "q8_0" | "q4_0" | "q4_1" | "q5_0" | "q5_1";
	parallel?: number;
	threads?: number;
	threadsBatch?: number;
	flashAttn?: "on" | "off" | "auto";
	chatTemplate?: string;
	gpuLayers?: number;
	batchSize?: number;
	ubatchSize?: number;
	ropeFreqBase?: number;
	ropeFreqScale?: number;
	jinja?: boolean;
	reasoningFormat?: "auto" | "deepseek" | "none";
	loraAdapter?: string;
}

export interface ModelPreset extends ReloadOptions {
	label?: string;
	description?: string;
	systemPrompt?: string;
	temperature?: number;
	topP?: number;
	topK?: number;
	minP?: number;
	repeatPenalty?: number;
	maxTokens?: number;
}

export interface RegisteredModel {
	id: string;
	modelFile: string;
	mmprojPath: string | null;
	vision: boolean;
	sizeBytes: number;
	preset?: ModelPreset;
}

export interface OrphanMmproj {
	file: string;
	expectedModelId: string;
	sizeBytes: number;
}

export interface HostSystemInfo {
	hostname: string;
	platform: string;
	arch: string;
	cpuModel: string;
	cpuCores: number;
	cpuUsagePct: number;
	ramTotalMiB: number;
	ramUsedMiB: number;
	ramFreeMiB: number;
	ramUsagePct: number;
	uptimeSeconds: number;
}

export interface EngineStatus {
	apiUptimeMs: number;
	runtimeRunning: boolean;
	runtimeHealthy: boolean;
	loadedModel?: string;
	ctxSize?: number;
	models: RegisteredModel[];
	orphanMmprojs?: OrphanMmproj[];
	gpu: GpuInfo;
	system?: HostSystemInfo;
	slots: SlotInfo[];
	timestamp: string;
}

export interface ActionResult {
	ok: boolean;
	message?: string;
}

export interface RuntimeHealth {
	running: boolean;
	healthy: boolean;
	loadedModel?: string;
	ctxSize?: number;
}

export interface RuntimeEngineConfig {
	port?: number;
	runtimeUrl?: string;
	runtimeContainer?: string;
	modelsDir?: string;
	rateLimit?: number | string | { enabled: boolean; windowMs: number; max: number };
}

export interface RuntimeConfig {
	engine: RuntimeEngineConfig;
	runtimeEnv: Record<string, string>;
}

export interface RuntimeLogs {
	lines: string[];
}

const API_URL_STORAGE = "llama-engine-api-url";
const API_KEY_STORAGE = "llama-engine-api-key";

export const DEFAULT_API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3050";
export const DEFAULT_API_KEY = import.meta.env.VITE_API_KEY ?? "";

export function getApiUrl(): string {
	try {
		const saved = window.localStorage.getItem(API_URL_STORAGE)?.trim();
		if (saved) return saved.replace(/\/+$/, "");
	} catch {}
	return DEFAULT_API_URL;
}

export function getApiKey(): string {
	try {
		const saved = window.localStorage.getItem(API_KEY_STORAGE)?.trim();
		if (saved) return saved;
	} catch {}
	return DEFAULT_API_KEY;
}

export function setApiCredentials(url?: string, key?: string): void {
	try {
		if (url !== undefined) {
			if (url.trim()) window.localStorage.setItem(API_URL_STORAGE, url.trim().replace(/\/+$/, ""));
			else window.localStorage.removeItem(API_URL_STORAGE);
		}
		if (key !== undefined) {
			if (key.trim()) window.localStorage.setItem(API_KEY_STORAGE, key.trim());
			else window.localStorage.removeItem(API_KEY_STORAGE);
		}
	} catch {}
}

export const API_URL = DEFAULT_API_URL;
export const API_KEY = DEFAULT_API_KEY;

async function get<T>(path: string): Promise<T> {
	const res = await fetch(`${getApiUrl()}${path}`, {
		headers: { "x-api-key": getApiKey() },
	});
	if (!res.ok) throw new Error(`${path} ${res.status}`);
	return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
	const hasBody = body !== undefined;
	const res = await fetch(`${getApiUrl()}${path}`, {
		method,
		headers: {
			"x-api-key": getApiKey(),
			...(hasBody ? { "Content-Type": "application/json" } : {}),
		},
		body: hasBody ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const errJson = await res.json().catch(() => null);
		const detail =
			(errJson as { error?: { message?: string } | string } | null)?.error &&
			typeof (errJson as { error?: { message?: string } }).error === "object"
				? (errJson as { error: { message?: string } }).error.message
				: typeof (errJson as { error?: string } | null)?.error === "string"
					? (errJson as { error: string }).error
					: "";
		throw new Error(detail ? `${detail} (${res.status})` : `${path} ${res.status}`);
	}
	return res.json() as Promise<T>;
}

export async function fetchStatus(): Promise<EngineStatus> {
	return get("/api/status");
}

export async function fetchRuntimeHealth(): Promise<RuntimeHealth> {
	return get("/api/runtime/health");
}

export async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
	return get("/api/runtime/config");
}

export async function fetchRuntimeLogs(tail = 100): Promise<RuntimeLogs> {
	return get(`/api/runtime/logs?tail=${tail}`);
}

export async function reloadModel(
	modelId: string,
	opts?: number | ReloadOptions,
): Promise<ActionResult> {
	const payload: Record<string, unknown> = { modelId };
	if (typeof opts === "number") {
		payload.ctxSize = opts;
	} else if (opts && typeof opts === "object") {
		for (const [k, v] of Object.entries(opts)) {
			if (v !== undefined && v !== "") payload[k] = v;
		}
	}
	return post("/api/models/reload", payload);
}

export async function saveModelPreset(
	modelId: string,
	preset: ModelPreset,
): Promise<{ ok: boolean; modelId: string; preset: ModelPreset }> {
	return post(`/api/models/${encodeURIComponent(modelId)}/preset`, preset, "PUT");
}

export async function deleteLocalModel(
	modelId: string,
	includeMmproj = false,
): Promise<ActionResult & { deletedFiles?: string[] }> {
	const qs = includeMmproj ? "?includeMmproj=true" : "";
	const res = await fetch(`${getApiUrl()}/api/models/${encodeURIComponent(modelId)}${qs}`, {
		method: "DELETE",
		headers: { "x-api-key": getApiKey() },
	});
	const data = (await res.json().catch(() => ({}))) as {
		ok?: boolean;
		message?: string;
		deletedFiles?: string[];
		error?: { message?: string };
	};
	if (!res.ok) {
		throw new Error(data.error?.message ?? `delete model ${res.status}`);
	}
	return { ok: true, message: data.message, deletedFiles: data.deletedFiles };
}

export async function restartRuntime(): Promise<ActionResult> {
	return post("/api/runtime/restart");
}

export async function stopRuntime(): Promise<ActionResult> {
	return post("/api/runtime/stop");
}

export async function startRuntime(): Promise<ActionResult> {
	return post("/api/runtime/start");
}

export interface HubModel {
	id: string;
	owner: string;
	name: string;
	downloads: number;
	likes: number;
	tags: string[];
	private: boolean;
}

export interface HubFile {
	path: string;
	size: number;
}

export interface HubRepoDetail {
	id: string;
	owner: string;
	name: string;
	downloads: number;
	likes: number;
	lastModified?: string;
	tags: string[];
	ggufFiles: HubFile[];
}

export interface HubDownloadJob {
	jobId: string;
	id: string;
	owner: string;
	name: string;
	file: string;
	status: "running" | "completed" | "failed";
	downloadedBytes: number;
	totalBytes: number;
	progress: number;
	error?: string;
}

export async function searchHf(q: string): Promise<HubModel[]> {
	const res = await get(`/api/hf/search?q=${encodeURIComponent(q)}`);
	return (res as { results: HubModel[] }).results;
}

export async function fetchHfRepo(owner: string, name: string): Promise<HubRepoDetail> {
	return get(`/api/hf/repo/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
}

export async function downloadHf(owner: string, name: string, file: string): Promise<ActionResult> {
	return post("/api/hf/download", { owner, name, file });
}

export async function startHfDownload(
	owner: string,
	name: string,
	file: string,
): Promise<{ ok: boolean; job: HubDownloadJob; message?: string }> {
	return post("/api/hf/download", { owner, name, file, async: true });
}

export async function listHfDownloadJobs(): Promise<HubDownloadJob[]> {
	const res = await get<{ jobs: HubDownloadJob[] }>("/api/hf/downloads");
	return res.jobs ?? [];
}

export async function getHfDownloadJob(jobId: string): Promise<HubDownloadJob> {
	return get(`/api/hf/downloads/${encodeURIComponent(jobId)}`);
}

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

export interface Dataset {
	id: string;
	name: string;
	examples: number;
	format: string;
	sizeBytes: number;
}

export interface ValidationResult {
	valid: boolean;
	format: string;
	examples: number;
	errors: string[];
}

export async function listDatasets(): Promise<Dataset[]> {
	const res = await get<{ datasets: Dataset[] }>("/api/datasets");
	return res.datasets;
}

export async function uploadDataset(file: File): Promise<Dataset> {
	const formData = new FormData();
	formData.append("file", file);
	const res = await fetch(`${getApiUrl()}/api/datasets`, {
		method: "POST",
		headers: { "x-api-key": getApiKey() },
		body: formData,
	});
	if (!res.ok) throw new Error(`upload ${res.status}`);
	return res.json() as Promise<Dataset>;
}

export async function appendDatasetExample(
	datasetId: string,
	messages: Array<{ role: string; content: string }>,
): Promise<Dataset> {
	return post(`/api/datasets/${encodeURIComponent(datasetId)}/append`, { messages });
}

export async function validateDataset(id: string): Promise<ValidationResult> {
	return get(`/api/datasets/${id}/validate`);
}

export interface DatasetPreviewItem {
	role: string;
	content: string;
}

export interface DatasetPreview {
	format: string;
	examples: DatasetPreviewItem[];
}

export async function previewDataset(id: string, limit = 3): Promise<DatasetPreview> {
	return get(`/api/datasets/${encodeURIComponent(id)}/preview?limit=${limit}`);
}

export async function deleteDataset(id: string): Promise<void> {
	const res = await fetch(`${getApiUrl()}/api/datasets/${id}`, {
		method: "DELETE",
		headers: { "x-api-key": getApiKey() },
	});
	if (!res.ok) throw new Error(`delete ${res.status}`);
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

export interface LossHistoryPoint {
	step: number;
	epoch: number;
	loss: number;
}

export interface TrainingJob {
	id: string;
	status: "pending" | "running" | "completed" | "failed" | "stopped";
	progress: number;
	epoch: number;
	totalEpochs: number;
	loss: number;
	evalLoss?: number;
	lossHistory?: LossHistoryPoint[];
	logs: string[];
	modelPath?: string;
}

export type TrainJob = TrainingJob;

export interface StartTrainingRequest {
	baseModelId: string;
	datasetId: string;
	method: "qlora" | "lora" | "full";
	epochs: number;
	learningRate: number;
	rank: number;
	batchSize: number;
	maxSeqLen: number;
	systemPrompt: string;
}

export async function startTraining(req: StartTrainingRequest): Promise<{ jobId: string }> {
	return post("/api/train/start", req);
}

export async function getTrainJob(jobId: string): Promise<TrainingJob> {
	return get(`/api/train/jobs/${jobId}`);
}

export async function listTrainJobs(): Promise<TrainingJob[]> {
	const res = await get<{ jobs: TrainingJob[] }>("/api/train/jobs");
	return res.jobs;
}

export async function stopTraining(jobId: string): Promise<void> {
	await post(`/api/train/jobs/${jobId}/stop`);
}

// ---------------------------------------------------------------------------
// Quantize
// ---------------------------------------------------------------------------

export interface QuantizeMethod {
	id: string;
	name: string;
	bits: number;
	size7b: string;
	quality: string;
}

export interface QuantizeResult {
	id?: string;
	jobId?: string;
	status?: string;
	method: string;
	inputPath?: string;
	outputPath?: string;
	inputSize?: number;
	outputSize: number;
	error?: string;
}

export async function getQuantizeMethods(): Promise<QuantizeMethod[]> {
	const res = await get<{ methods: QuantizeMethod[] }>("/api/quantize/methods");
	return res.methods;
}

export async function quantizeModel(
	modelId: string,
	method: string,
	useImatrix?: boolean,
): Promise<QuantizeResult> {
	return post("/api/quantize", { modelId, method, imatrix: useImatrix });
}

export async function getQuantizeJob(jobId: string): Promise<QuantizeResult> {
	return get(`/api/quantize/jobs/${encodeURIComponent(jobId)}`);
}

// ---------------------------------------------------------------------------
// Deploy
// ---------------------------------------------------------------------------

export async function deployModel(modelName: string, activate: boolean): Promise<ActionResult> {
	return post("/api/models/deploy", { modelName, activate });
}

// ---------------------------------------------------------------------------
// OpenAI-compatible Playground & Benchmark (/v1/chat/completions)
// ---------------------------------------------------------------------------

export type ChatContentPart =
	| { type: "text"; text: string }
	| { type: "image_url"; image_url: { url: string } };

export interface ChatMessagePayload {
	role: "system" | "user" | "assistant";
	content: string | ChatContentPart[];
}

export interface ChatStreamStats {
	ttftMs: number;
	elapsedSec: number;
	chunksCount: number;
	tokPerSec: number;
	promptTokens?: number;
	completionTokens?: number;
}

export interface ChatCompletionOptions {
	model: string;
	messages: ChatMessagePayload[];
	temperature?: number;
	topP?: number;
	topK?: number;
	minP?: number;
	repeatPenalty?: number;
	seed?: number;
	maxTokens?: number;
	jsonMode?: boolean;
	signal?: AbortSignal;
	onToken: (delta: string, reasoningDelta?: string) => void;
	onComplete?: (stats: ChatStreamStats) => void;
}

export async function streamChatCompletion(opts: ChatCompletionOptions): Promise<ChatStreamStats> {
	const startedAt = performance.now();
	let firstTokenAt: number | null = null;
	let chunksCount = 0;
	let promptTokens: number | undefined;
	let completionTokens: number | undefined;

	const payload: Record<string, unknown> = {
		model: opts.model,
		messages: opts.messages,
		stream: true,
		temperature: opts.temperature ?? 0.7,
		top_p: opts.topP ?? 0.9,
		max_tokens: opts.maxTokens ?? 1024,
	};
	if (opts.topK !== undefined && opts.topK > 0) payload.top_k = opts.topK;
	if (opts.minP !== undefined && opts.minP > 0) payload.min_p = opts.minP;
	if (opts.repeatPenalty !== undefined && opts.repeatPenalty !== 1) {
		payload.repeat_penalty = opts.repeatPenalty;
	}
	if (opts.seed !== undefined && Number.isFinite(opts.seed)) payload.seed = opts.seed;
	if (opts.jsonMode) payload.response_format = { type: "json_object" };

	const res = await fetch(`${getApiUrl()}/v1/chat/completions`, {
		method: "POST",
		headers: {
			"x-api-key": getApiKey(),
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
		signal: opts.signal,
	});

	if (!res.ok) {
		const errText = await res.text().catch(() => "");
		throw new Error(`HTTP ${res.status}${errText ? `: ${errText.slice(0, 140)}` : ""}`);
	}

	if (!res.body) {
		throw new Error("El servidor no devolvió un stream de respuesta");
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder("utf-8");
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";

		for (const rawLine of lines) {
			const line = rawLine.trim();
			if (!line?.startsWith("data:")) continue;
			const dataStr = line.slice(5).trim();
			if (dataStr === "[DONE]") {
				const elapsedSec = Math.max(0.05, (performance.now() - startedAt) / 1000);
				const ttftMs = firstTokenAt
					? Math.round(firstTokenAt - startedAt)
					: Math.round(elapsedSec * 1000);
				const totalTok = completionTokens ?? chunksCount;
				const stats: ChatStreamStats = {
					ttftMs,
					elapsedSec,
					chunksCount: totalTok,
					tokPerSec: totalTok / elapsedSec,
					promptTokens,
					completionTokens,
				};
				opts.onComplete?.(stats);
				return stats;
			}
			try {
				const parsed = JSON.parse(dataStr) as {
					choices?: Array<{
						delta?: { content?: string; reasoning_content?: string };
						message?: { content?: string; reasoning_content?: string };
					}>;
					usage?: { prompt_tokens?: number; completion_tokens?: number };
					timings?: { prompt_n?: number; predicted_n?: number; predicted_per_second?: number };
				};
				if (parsed.usage?.prompt_tokens) promptTokens = parsed.usage.prompt_tokens;
				if (parsed.usage?.completion_tokens) completionTokens = parsed.usage.completion_tokens;
				if (parsed.timings?.prompt_n) promptTokens = parsed.timings.prompt_n;
				if (parsed.timings?.predicted_n) completionTokens = parsed.timings.predicted_n;

				const choice = parsed.choices?.[0];
				const piece = choice?.delta?.content ?? choice?.message?.content ?? "";
				const reasoningPiece =
					choice?.delta?.reasoning_content ?? choice?.message?.reasoning_content ?? "";
				if (piece || reasoningPiece) {
					if (firstTokenAt === null) firstTokenAt = performance.now();
					chunksCount += 1;
					opts.onToken(piece, reasoningPiece || undefined);
				}
			} catch {
				// Ignore partial JSON lines
			}
		}
	}

	const elapsedSec = Math.max(0.05, (performance.now() - startedAt) / 1000);
	const ttftMs = firstTokenAt
		? Math.round(firstTokenAt - startedAt)
		: Math.round(elapsedSec * 1000);
	const totalTok = completionTokens ?? chunksCount;
	const stats: ChatStreamStats = {
		ttftMs,
		elapsedSec,
		chunksCount: totalTok,
		tokPerSec: totalTok / elapsedSec,
		promptTokens,
		completionTokens,
	};
	opts.onComplete?.(stats);
	return stats;
}
