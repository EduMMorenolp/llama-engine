import type { AppConfig } from "../config.js";
import type { ModelRegistry, OrphanMmproj, RegisteredModel } from "../models/registry.js";
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
	ctxSize?: number;
	models: RegisteredModel[];
	orphanMmprojs?: OrphanMmproj[];
	gpu: GpuInfo;
	slots: SlotInfo[];
	timestamp: string;
}

const GPU_CACHE_TTL_MS = 1_500;

/**
 * Telemetría del motor: GPU (vía nvidia-smi en el runtime con caché corto),
 * estado de llama-server (health + slots con throughput tok/s + props) y registro de modelos.
 */
export class StatusService {
	private readonly startedAt = Date.now();
	private gpuCache: { at: number; info: GpuInfo } | null = null;

	constructor(
		private readonly config: AppConfig,
		private readonly runtime: RuntimeManager,
		private readonly registry: ModelRegistry,
	) {}

	async getGpu(): Promise<GpuInfo> {
		const now = Date.now();
		if (this.gpuCache && now - this.gpuCache.at < GPU_CACHE_TTL_MS) {
			return this.gpuCache.info;
		}
		const out = await this.runtime.exec(
			"nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,power.draw --format=csv,noheader,nounits",
		);
		const line = out.trim();
		if (!line) {
			const fallback: GpuInfo = { available: false };
			this.gpuCache = { at: now, info: fallback };
			return fallback;
		}
		try {
			const [name, total, used, free, util, temp, power] = line.split(",").map((s) => s.trim());
			const info: GpuInfo = {
				available: true,
				name,
				vramTotalMiB: n(total),
				vramUsedMiB: n(used),
				vramFreeMiB: n(free),
				gpuUtilPct: n(util),
				temperatureC: n(temp),
				powerDrawW: n(power),
			};
			this.gpuCache = { at: now, info };
			return info;
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

	private async getProps(): Promise<{ loadedModel?: string; ctxSize?: number }> {
		try {
			const res = await fetch(`${this.config.runtimeUrl}/props`, {
				signal: AbortSignal.timeout(3000),
			});
			if (!res.ok) return {};
			const json = (await res.json()) as {
				model_alias?: string;
				model_path?: string;
				default_generation_settings?: { model?: string; n_ctx?: number };
			};
			const modelPath =
				json.model_alias || json.model_path || json.default_generation_settings?.model;
			const loadedModel = modelPath
				? (modelPath.split(/[\\/]/).pop() || modelPath).replace(/\.gguf$/, "")
				: undefined;
			return {
				loadedModel,
				ctxSize: json?.default_generation_settings?.n_ctx,
			};
		} catch {
			return {};
		}
	}

	async loadedModel(): Promise<string | undefined> {
		const props = await this.getProps();
		return props.loadedModel;
	}

	/** true si llama-server responde /health. */
	async isHealthy(): Promise<boolean> {
		return (await this.fetchRuntime("/health")) !== null;
	}

	/** n_ctx activo del runtime (default_generation_settings), si responde /props. */
	async ctxSize(): Promise<number | undefined> {
		const props = await this.getProps();
		return props.ctxSize;
	}

	async status(): Promise<EngineStatus> {
		const [running, healthy, gpu, slots, props] = await Promise.all([
			this.runtime.isRunning(),
			this.fetchRuntime("/health").then((h) => h !== null),
			this.getGpu(),
			this.getSlots(),
			this.getProps(),
		]);
		return {
			apiUptimeMs: Date.now() - this.startedAt,
			runtimeRunning: running,
			runtimeHealthy: healthy,
			loadedModel: props.loadedModel,
			ctxSize: props.ctxSize,
			models: this.registry.list(),
			orphanMmprojs: this.registry.listOrphanMmprojs(),
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
