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

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3050";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

export async function fetchStatus(): Promise<EngineStatus> {
	const res = await fetch(`${API_URL}/api/status`, {
		headers: { "x-api-key": API_KEY },
	});
	if (!res.ok) throw new Error(`status ${res.status}`);
	return res.json() as Promise<EngineStatus>;
}

export { API_URL };
