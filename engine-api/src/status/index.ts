import type { AppConfig } from "../config.js";
import type { ModelRegistry, RegisteredModel } from "../models/registry.js";
import type { RuntimeManager } from "../runtime/manager.js";

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

/**
 * Telemetría del motor: GPU (vía nvidia-smi en el runtime), estado de llama-server
 * (health + slots con throughput tok/s) y registro de modelos.
 */
export class StatusService {
	private readonly startedAt = Date.now();

	constructor(
		private readonly config: AppConfig,
		private readonly runtime: RuntimeManager,
		private readonly registry: ModelRegistry,
	) {}

	async getGpu(): Promise<GpuInfo> {
		const out = await this.runtime.exec(
			"nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,power.draw --format=csv,noheader,nounits",
		);
		const line = out.trim();
		if (!line) return { available: false };
		try {
			const [name, total, used, free, util, temp, power] = line.split(",").map((s) => s.trim());
			return {
				available: true,
				name,
				vramTotalMiB: n(total),
				vramUsedMiB: n(used),
				vramFreeMiB: n(free),
				gpuUtilPct: n(util),
				temperatureC: n(temp),
				powerDrawW: n(power),
			};
		} catch {
			return { available: false };
		}
	}

	private async fetchRuntime(path: string, timeoutMs = 3000): Promise<unknown | null> {
		try {
			const ctrl = new AbortController();
			const t = setTimeout(() => ctrl.abort(), timeoutMs);
			const res = await fetch(`${this.config.runtimeUrl}${path}`, { signal: ctrl.signal });
			clearTimeout(t);
			if (!res.ok) return null;
			return res.json();
		} catch {
			return null;
		}
	}

	async getSlots(): Promise<SlotInfo[]> {
		const data = (await this.fetchRuntime("/slots")) as Array<Record<string, unknown>> | null;
		if (!Array.isArray(data)) return [];
		return data
			.map((s) => ({
				id: Number(s.id ?? -1),
				model: String(s.model ?? ""),
				promptN: Number(s.prompt_n ?? 0),
				predictedN: Number(s.predicted_n ?? 0),
				promptPerSec: Number(s.prompt_per_seconds ?? 0),
				predictedPerSec: Number(s.predicted_per_seconds ?? 0),
				totalPerSec: Number(s.total_per_seconds ?? 0),
			}))
			.filter((s) => s.id >= 0);
	}

	async loadedModel(): Promise<string | undefined> {
		try {
			const res = await fetch(`${this.config.runtimeUrl}/props`, {
				signal: AbortSignal.timeout(3000),
			});
			if (!res.ok) return undefined;
			const json = (await res.json()) as { default_generation_settings?: { model?: string } };
			const modelPath = json?.default_generation_settings?.model;
			if (!modelPath) return undefined;
			return (modelPath.split(/[\\/]/).pop() || modelPath).replace(/\.gguf$/, "");
		} catch {
			return undefined;
		}
	}

	async status(): Promise<EngineStatus> {
		const [running, healthy, gpu, slots, loadedModel] = await Promise.all([
			this.runtime.isRunning(),
			this.fetchRuntime("/health").then((h) => h !== null),
			this.getGpu(),
			this.getSlots(),
			this.loadedModel(),
		]);
		return {
			apiUptimeMs: Date.now() - this.startedAt,
			runtimeRunning: running,
			runtimeHealthy: healthy,
			loadedModel,
			models: this.registry.list(),
			gpu,
			slots,
			timestamp: new Date().toISOString(),
		};
	}
}

function n(v: string): number | undefined {
	const num = Number(v);
	return Number.isNaN(num) ? undefined : num;
}
