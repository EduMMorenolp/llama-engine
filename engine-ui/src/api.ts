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

export interface RegisteredModel {
	id: string;
	modelFile: string;
	mmprojPath: string | null;
	vision: boolean;
	sizeBytes: number;
}

export interface EngineStatus {
	apiUptimeMs: number;
	runtimeRunning: boolean;
	runtimeHealthy: boolean;
	loadedModel?: string;
	models: RegisteredModel[];
	gpu: GpuInfo;
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

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3050";
export const API_KEY = import.meta.env.VITE_API_KEY ?? "";

async function get<T>(path: string): Promise<T> {
	const res = await fetch(`${API_URL}${path}`, {
		headers: { "x-api-key": API_KEY },
	});
	if (!res.ok) throw new Error(`${path} ${res.status}`);
	return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
	const hasBody = body !== undefined;
	const res = await fetch(`${API_URL}${path}`, {
		method: "POST",
		headers: {
			"x-api-key": API_KEY,
			...(hasBody ? { "Content-Type": "application/json" } : {}),
		},
		body: hasBody ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) throw new Error(`${path} ${res.status}`);
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

export interface ReloadOptions {
	ctxSize?: number;
	cacheTypeK?: "f16" | "q8_0" | "q4_0" | "q4_1" | "q5_0" | "q5_1";
	cacheTypeV?: "f16" | "q8_0" | "q4_0" | "q4_1" | "q5_0" | "q5_1";
	parallel?: number;
	threads?: number;
	flashAttn?: "on" | "off" | "auto";
}

export async function reloadModel(
	modelId: string,
	opts?: number | ReloadOptions,
): Promise<ActionResult> {
	const payload: Record<string, unknown> = { modelId };
	if (typeof opts === "number") {
		payload.ctxSize = opts;
	} else if (opts && typeof opts === "object") {
		if (opts.ctxSize != null) payload.ctxSize = opts.ctxSize;
		if (opts.cacheTypeK) payload.cacheTypeK = opts.cacheTypeK;
		if (opts.cacheTypeV) payload.cacheTypeV = opts.cacheTypeV;
		if (opts.parallel != null) payload.parallel = opts.parallel;
		if (opts.threads != null) payload.threads = opts.threads;
		if (opts.flashAttn) payload.flashAttn = opts.flashAttn;
	}
	return post("/api/models/reload", payload);
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
	const res = await fetch(`${API_URL}/api/datasets`, {
		method: "POST",
		headers: { "x-api-key": API_KEY },
		body: formData,
	});
	if (!res.ok) throw new Error(`upload ${res.status}`);
	return res.json() as Promise<Dataset>;
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
	const res = await fetch(`${API_URL}/api/datasets/${id}`, {
		method: "DELETE",
		headers: { "x-api-key": API_KEY },
	});
	if (!res.ok) throw new Error(`delete ${res.status}`);
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

export interface TrainingJob {
	id: string;
	status: "pending" | "running" | "completed" | "failed";
	progress: number;
	epoch: number;
	totalEpochs: number;
	loss: number;
	evalLoss?: number;
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
// OpenAI-compatible Playground (/v1/chat/completions)
// ---------------------------------------------------------------------------

export type ChatContentPart =
	| { type: "text"; text: string }
	| { type: "image_url"; image_url: { url: string } };

export interface ChatMessagePayload {
	role: "system" | "user" | "assistant";
	content: string | ChatContentPart[];
}

export interface ChatCompletionOptions {
	model: string;
	messages: ChatMessagePayload[];
	temperature?: number;
	topP?: number;
	maxTokens?: number;
	signal?: AbortSignal;
	onToken: (delta: string) => void;
}

export async function streamChatCompletion(opts: ChatCompletionOptions): Promise<void> {
	const res = await fetch(`${API_URL}/v1/chat/completions`, {
		method: "POST",
		headers: {
			"x-api-key": API_KEY,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: opts.model,
			messages: opts.messages,
			stream: true,
			temperature: opts.temperature ?? 0.7,
			top_p: opts.topP ?? 0.9,
			max_tokens: opts.maxTokens ?? 1024,
		}),
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
			const payload = line.slice(5).trim();
			if (payload === "[DONE]") return;
			try {
				const parsed = JSON.parse(payload) as {
					choices?: Array<{
						delta?: { content?: string; reasoning_content?: string };
						message?: { content?: string };
					}>;
				};
				const choice = parsed.choices?.[0];
				const piece = choice?.delta?.content ?? choice?.message?.content ?? "";
				if (piece) opts.onToken(piece);
			} catch {
				// Ignore partial JSON lines
			}
		}
	}
}
