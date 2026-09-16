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
	rateLimit?: number | string;
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

export async function reloadModel(modelId: string, ctxSize?: number): Promise<ActionResult> {
	return post("/api/models/reload", { modelId, ...(ctxSize != null ? { ctxSize } : {}) });
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
	method: string;
	inputPath: string;
	outputPath: string;
	inputSize: number;
	outputSize: number;
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

// ---------------------------------------------------------------------------
// Deploy
// ---------------------------------------------------------------------------

export async function deployModel(modelName: string, activate: boolean): Promise<ActionResult> {
	return post("/api/models/deploy", { modelName, activate });
}
