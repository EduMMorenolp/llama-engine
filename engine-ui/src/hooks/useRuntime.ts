import {
	createContext,
	createElement,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import type { EngineStatus, RuntimeConfig, RuntimeHealth } from "../api";
import { fetchRuntimeConfig, fetchRuntimeHealth, fetchStatus } from "../api";

export const POLL_MS = 3000;
const MAX_SERIES_POINTS = 120;
const POLL_STORAGE_KEY = "llama-engine-poll-ms";

export interface TelemetryPoint {
	t: number;
	tok: number;
	promptTok: number;
	gpuUtil: number;
	vramUsedMiB: number;
	tempC: number;
	powerW: number;
}

export interface RuntimeState {
	status: EngineStatus | null;
	health: RuntimeHealth | null;
	config: RuntimeConfig | null;
	error: string | null;
	loading: boolean;
	refresh: () => void;
	series: TelemetryPoint[];
	clearSeries: () => void;
	pollMs: number;
	setPollMs: (ms: number) => void;
	paused: boolean;
	setPaused: (paused: boolean) => void;
	lastUpdated: number | null;
}

const RuntimeContext = createContext<RuntimeState | null>(null);

function appendTelemetryPoint(prev: TelemetryPoint[], s: EngineStatus): TelemetryPoint[] {
	const tok = s.slots.reduce((acc, slot) => acc + (slot.predictedPerSec || 0), 0);
	const promptTok = s.slots.reduce((acc, slot) => acc + (slot.promptPerSec || 0), 0);
	const gpuUtil = s.gpu.available ? (s.gpu.gpuUtilPct ?? 0) : 0;
	const vramUsedMiB = s.gpu.available ? (s.gpu.vramUsedMiB ?? 0) : 0;
	const tempC = s.gpu.available ? (s.gpu.temperatureC ?? 0) : 0;
	const powerW = s.gpu.available ? (s.gpu.powerDrawW ?? 0) : 0;

	const next: TelemetryPoint[] = [
		...prev,
		{ t: Date.now(), tok, promptTok, gpuUtil, vramUsedMiB, tempC, powerW },
	];
	return next.length > MAX_SERIES_POINTS ? next.slice(next.length - MAX_SERIES_POINTS) : next;
}

function useStandaloneRuntime(skipConfig = false, enabled = true): RuntimeState {
	const [status, setStatus] = useState<EngineStatus | null>(null);
	const [health, setHealth] = useState<RuntimeHealth | null>(null);
	const [config, setConfig] = useState<RuntimeConfig | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(enabled);
	const [series, setSeries] = useState<TelemetryPoint[]>([]);
	const [pollMs, setPollMsState] = useState<number>(() => {
		try {
			const saved = Number(window.localStorage.getItem(POLL_STORAGE_KEY));
			if ([2000, 3000, 5000, 10000].includes(saved)) return saved;
		} catch {}
		return POLL_MS;
	});
	const [paused, setPaused] = useState<boolean>(false);
	const [lastUpdated, setLastUpdated] = useState<number | null>(null);
	const loadRef = useRef<(() => Promise<void>) | null>(null);

	const setPollMs = useCallback((ms: number) => {
		setPollMsState(ms);
		try {
			window.localStorage.setItem(POLL_STORAGE_KEY, String(ms));
		} catch {}
	}, []);

	const clearSeries = useCallback(() => {
		setSeries([]);
	}, []);

	useEffect(() => {
		if (!enabled) return;
		let cancelled = false;
		let timer: number | null = null;

		const load = async () => {
			try {
				const jobs: Promise<unknown>[] = [fetchStatus()];
				if (!skipConfig) {
					jobs.push(fetchRuntimeHealth(), fetchRuntimeConfig());
				}
				const [s, h, c] = (await Promise.all(jobs)) as [
					EngineStatus,
					RuntimeHealth?,
					RuntimeConfig?,
				];
				if (cancelled) return;
				setStatus(s);
				if (!skipConfig) {
					setHealth(h ?? null);
					setConfig(c ?? null);
				}
				setSeries((prev) => appendTelemetryPoint(prev, s));
				setLastUpdated(Date.now());
				setError(null);
			} catch (e) {
				if (cancelled) return;
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				if (!cancelled) setLoading(false);
			}
		};

		loadRef.current = load;
		void load();
		if (!paused && pollMs > 0) {
			timer = window.setInterval(load, pollMs);
		}
		return () => {
			cancelled = true;
			if (timer) window.clearInterval(timer);
		};
	}, [skipConfig, pollMs, paused, enabled]);

	const refresh = useCallback(() => {
		const load = loadRef.current;
		if (load) void load();
	}, []);

	return {
		status,
		health,
		config,
		error,
		loading,
		refresh,
		series,
		clearSeries,
		pollMs,
		setPollMs,
		paused,
		setPaused,
		lastUpdated,
	};
}

export function RuntimeProvider({ children }: { children: ReactNode }) {
	const state = useStandaloneRuntime(false, true);
	return createElement(RuntimeContext.Provider, { value: state }, children);
}

export function useRuntime(skipConfig = false): RuntimeState {
	const ctx = useContext(RuntimeContext);
	const standalone = useStandaloneRuntime(skipConfig, !ctx);
	// When inside RuntimeProvider, return the shared singleton state without starting a second poll loop.
	return ctx ?? standalone;
}
