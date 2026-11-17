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
	isProcessing?: boolean;
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
const RECENT_INFERENCE_TTL_MS = 15_000;

export interface InferencePulse {
	at: number;
	model: string;
	promptN: number;
	predictedN: number;
	promptPerSec: number;
	predictedPerSec: number;
}

/**
 * Telemetría del motor: GPU (vía nvidia-smi en el runtime con caché corto),
 * estado de llama-server (health + slots + logs + pulsos del proxy /v1) y registro de modelos.
 */
export class StatusService {
	private readonly startedAt = Date.now();
	private gpuCache: { at: number; info: GpuInfo } | null = null;
	private lastPulse: InferencePulse | null = null;
	private readonly pulseListeners = new Set<(pulse: InferencePulse) => void>();

	constructor(
		private readonly config: AppConfig,
		private readonly runtime: RuntimeManager,
		private readonly registry: ModelRegistry,
	) {}

	onPulse(listener: (pulse: InferencePulse) => void): () => void {
		this.pulseListeners.add(listener);
		return () => this.pulseListeners.delete(listener);
	}

	recordInferencePulse(pulse: Omit<InferencePulse, "at">): void {
		const full: InferencePulse = { ...pulse, at: Date.now() };
		this.lastPulse = full;
		for (const listener of this.pulseListeners) {
			try {
				listener(full);
			} catch {}
		}
	}

	async getGpu(): Promise<GpuInfo> {
		const now = Date.now();
		if (this.gpuCache && now - this.gpuCache.at < GPU_CACHE_TTL_MS) {
			return this.gpuCache.info;
		}
		const out = await this.runtime.exec(
			"nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,power.draw --format=csv,noheader,nounits",
		);
		const line = out.replace(/^[^\x20-\x7E]+/, "").trim();
		if (!line) {
			const fallback: GpuInfo = { available: false };
			this.gpuCache = { at: now, info: fallback };
			return fallback;
		}
		try {
			const [rawName, total, used, free, util, temp, power] = line.split(",").map((s) => s.trim());
			const nvidiaIdx = rawName.search(/NVIDIA|GeForce|RTX|GTX|Tesla|Quadro/i);
			const name = (
				nvidiaIdx >= 0 ? rawName.slice(nvidiaIdx) : rawName.replace(/^[^a-zA-Z0-9]+/, "")
			).trim();
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

	/**
	 * Parsea las últimas líneas de log de llama-server para extraer el último
	 * `prompt eval time` y `eval time` en caso de que `/slots` no reporte timings.
	 */
	private async getRecentLogTimings(): Promise<{
		promptN: number;
		promptPerSec: number;
		predictedN: number;
		predictedPerSec: number;
	} | null> {
		try {
			const raw = await this.runtime.logs(40);
			if (!raw) return null;
			let promptN = 0;
			let promptPerSec = 0;
			let predictedN = 0;
			let predictedPerSec = 0;

			// Ejemplo llama-server:
			// prompt eval time =     123.45 ms /    42 tokens (    2.94 ms per token,   340.22 tokens per second)
			//        eval time =    2100.12 ms /    95 tokens (   22.11 ms per token,    45.24 tokens per second)
			const promptMatches = [
				...raw.matchAll(
					/prompt eval time\s*=\s*[\d.]+\s*ms\s*\/\s*(\d+)\s*tokens\s*\([^,]+,\s*([\d.]+)\s*tokens per second\)/gi,
				),
			];
			if (promptMatches.length > 0) {
				const last = promptMatches[promptMatches.length - 1];
				promptN = Number(last[1] ?? 0);
				promptPerSec = Number(last[2] ?? 0);
			}

			const evalMatches = [
				...raw.matchAll(
					/(?<!prompt\s)eval time\s*=\s*[\d.]+\s*ms\s*\/\s*(\d+)\s*tokens\s*\([^,]+,\s*([\d.]+)\s*tokens per second\)/gi,
				),
			];
			if (evalMatches.length > 0) {
				const last = evalMatches[evalMatches.length - 1];
				predictedN = Number(last[1] ?? 0);
				predictedPerSec = Number(last[2] ?? 0);
			}

			if (predictedPerSec > 0 || promptPerSec > 0) {
				return { promptN, promptPerSec, predictedN, predictedPerSec };
			}
			return null;
		} catch {
			return null;
		}
	}

	async getSlots(loadedModelName?: string): Promise<SlotInfo[]> {
		const data = (await this.fetchRuntime("/slots")) as Array<Record<string, unknown>> | null;
		const now = Date.now();
		const activePulse =
			this.lastPulse && now - this.lastPulse.at <= RECENT_INFERENCE_TTL_MS ? this.lastPulse : null;

		if (Array.isArray(data) && data.length > 0) {
			const mapped = data
				.map((s) => {
					const perf = (s.perf ?? s.timings ?? {}) as Record<string, unknown>;
					const nextTask = (Array.isArray(s.next_token) ? s.next_token[0] : s.next_token) as
						| Record<string, unknown>
						| undefined;

					const promptN = Number(s.prompt_n ?? perf.prompt_n ?? s.n_past ?? nextTask?.n_past ?? 0);
					const predictedN = Number(
						s.predicted_n ?? perf.predicted_n ?? s.n_decoded ?? nextTask?.n_decoded ?? 0,
					);
					const promptPerSec = Number(
						s.prompt_per_seconds ?? perf.prompt_per_second ?? perf.prompt_per_seconds ?? 0,
					);
					const predictedPerSec = Number(
						s.predicted_per_seconds ?? perf.predicted_per_second ?? perf.predicted_per_seconds ?? 0,
					);
					const isProcessing = Boolean(s.is_processing ?? s.state === 1);

					return {
						id: Number(s.id ?? 0),
						model: String(s.model || loadedModelName || ""),
						promptN,
						predictedN,
						promptPerSec,
						predictedPerSec,
						totalPerSec: Number(s.total_per_seconds ?? promptPerSec + predictedPerSec),
						isProcessing,
					};
				})
				.filter((s) => s.id >= 0);

			// Si los slots vinieron en 0 pero tenemos un pulso reciente del proxy /v1, enriquecer el slot 0
			const hasAnySpeed = mapped.some((s) => s.predictedPerSec > 0 || s.promptPerSec > 0);
			if (!hasAnySpeed && activePulse && mapped.length > 0) {
				mapped[0] = {
					...mapped[0],
					promptN: activePulse.promptN || mapped[0].promptN,
					predictedN: activePulse.predictedN || mapped[0].predictedN,
					promptPerSec: activePulse.promptPerSec,
					predictedPerSec: activePulse.predictedPerSec,
					totalPerSec: activePulse.promptPerSec + activePulse.predictedPerSec,
				};
			}
			return mapped;
		}

		// Si /slots no devolvió lista pero hay actividad reciente en el proxy o en logs
		if (activePulse) {
			return [
				{
					id: 0,
					model: activePulse.model || loadedModelName || "",
					promptN: activePulse.promptN,
					predictedN: activePulse.predictedN,
					promptPerSec: activePulse.promptPerSec,
					predictedPerSec: activePulse.predictedPerSec,
					totalPerSec: activePulse.promptPerSec + activePulse.predictedPerSec,
				},
			];
		}

		const logTimings = await this.getRecentLogTimings();
		if (logTimings) {
			return [
				{
					id: 0,
					model: loadedModelName || "",
					promptN: logTimings.promptN,
					predictedN: logTimings.predictedN,
					promptPerSec: logTimings.promptPerSec,
					predictedPerSec: logTimings.predictedPerSec,
					totalPerSec: logTimings.promptPerSec + logTimings.predictedPerSec,
				},
			];
		}

		return [];
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
		const [running, healthy, gpu, props] = await Promise.all([
			this.runtime.isRunning(),
			this.fetchRuntime("/health").then((h) => h !== null),
			this.getGpu(),
			this.getProps(),
		]);
		const slots = await this.getSlots(props.loadedModel);
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
