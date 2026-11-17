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
import { fetchRuntimeConfig, fetchRuntimeHealth, fetchStatus, getApiKey, getApiUrl } from "../api";

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
	recordClientPulse: (tokPerSec: number, promptPerSec?: number) => void;
	pollMs: number;
	setPollMs: (ms: number) => void;
	paused: boolean;
	setPaused: (paused: boolean) => void;
	lastUpdated: number | null;
	wsConnected: boolean;
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

function buildWsUrl(pollMs: number): string {
	const base = getApiUrl();
	const wsBase = base.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
	const key = encodeURIComponent(getApiKey());
	return `${wsBase}/api/ws?apiKey=${key}&pollMs=${pollMs}`;
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
	const [paused, setPausedState] = useState<boolean>(false);
	const [lastUpdated, setLastUpdated] = useState<number | null>(null);
	const [wsConnected, setWsConnected] = useState<boolean>(false);

	const wsRef = useRef<WebSocket | null>(null);
	const pollMsRef = useRef<number>(pollMs);
	pollMsRef.current = pollMs;
	const pausedRef = useRef<boolean>(paused);
	pausedRef.current = paused;

	const clearSeries = useCallback(() => {
		setSeries([]);
	}, []);

	const recordClientPulse = useCallback((tokPerSec: number, promptPerSec = 0) => {
		setSeries((prev) => {
			const last = prev[prev.length - 1];
			const nextPoint: TelemetryPoint = {
				t: Date.now(),
				tok: Number(tokPerSec.toFixed(1)),
				promptTok: Number(promptPerSec.toFixed(1)),
				gpuUtil: last?.gpuUtil ?? 0,
				vramUsedMiB: last?.vramUsedMiB ?? 0,
				tempC: last?.tempC ?? 0,
				powerW: last?.powerW ?? 0,
			};
			const next = [...prev, nextPoint];
			return next.length > MAX_SERIES_POINTS ? next.slice(next.length - MAX_SERIES_POINTS) : next;
		});
	}, []);

	const httpFallbackLoad = useCallback(async () => {
		try {
			const jobs: Promise<unknown>[] = [fetchStatus()];
			if (!skipConfig) {
				jobs.push(fetchRuntimeHealth(), fetchRuntimeConfig());
			}
			const [s, h, c] = (await Promise.all(jobs)) as [EngineStatus, RuntimeHealth?, RuntimeConfig?];
			setStatus(s);
			if (!skipConfig) {
				setHealth(h ?? null);
				setConfig(c ?? null);
			}
			setSeries((prev) => appendTelemetryPoint(prev, s));
			setLastUpdated(Date.now());
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	}, [skipConfig]);

	const setPollMs = useCallback((ms: number) => {
		setPollMsState(ms);
		try {
			window.localStorage.setItem(POLL_STORAGE_KEY, String(ms));
		} catch {}
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({ type: "set_interval", pollMs: ms }));
		}
	}, []);

	const setPaused = useCallback((nextPaused: boolean) => {
		setPausedState(nextPaused);
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({ type: "pause", paused: nextPaused }));
		}
	}, []);

	const refresh = useCallback(() => {
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({ type: "refresh" }));
		} else {
			void httpFallbackLoad();
		}
	}, [httpFallbackLoad]);

	// Conexión principal WebSocket con reconexión automática
	useEffect(() => {
		if (!enabled) return;
		let disposed = false;
		let reconnectTimer: number | null = null;
		let fallbackTimer: number | null = null;

		const startFallbackInterval = () => {
			if (fallbackTimer || disposed) return;
			fallbackTimer = window.setInterval(() => {
				if (!pausedRef.current && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
					void httpFallbackLoad();
				}
			}, pollMsRef.current);
		};

		const stopFallbackInterval = () => {
			if (fallbackTimer) {
				window.clearInterval(fallbackTimer);
				fallbackTimer = null;
			}
		};

		const connect = () => {
			if (disposed) return;
			try {
				const ws = new WebSocket(buildWsUrl(pollMsRef.current));
				wsRef.current = ws;

				ws.onopen = () => {
					if (disposed) {
						ws.close();
						return;
					}
					setWsConnected(true);
					setError(null);
					stopFallbackInterval();
					if (pausedRef.current) {
						ws.send(JSON.stringify({ type: "pause", paused: true }));
					}
				};

				ws.onmessage = (event) => {
					if (disposed) return;
					try {
						const data = JSON.parse(String(event.data)) as {
							type?: string;
							status?: EngineStatus;
							health?: RuntimeHealth;
							config?: RuntimeConfig;
							pulse?: {
								model: string;
								promptN: number;
								predictedN: number;
								promptPerSec: number;
								predictedPerSec: number;
							};
						};

						if (data.type === "telemetry" && data.status) {
							setStatus(data.status);
							if (data.health) setHealth(data.health);
							if (data.config) setConfig(data.config);
							setSeries((prev) => appendTelemetryPoint(prev, data.status as EngineStatus));
							setLastUpdated(Date.now());
							setError(null);
							setLoading(false);
						} else if (data.type === "pulse" && data.pulse) {
							const p = data.pulse;
							recordClientPulse(p.predictedPerSec, p.promptPerSec);
							setStatus((prev) => {
								if (!prev) return prev;
								const updatedSlots =
									prev.slots.length > 0
										? prev.slots.map((s, idx) =>
												idx === 0
													? {
															...s,
															promptN: p.promptN || s.promptN,
															predictedN: p.predictedN || s.predictedN,
															promptPerSec: p.promptPerSec,
															predictedPerSec: p.predictedPerSec,
														}
													: s,
											)
										: [
												{
													id: 0,
													model: p.model || prev.loadedModel || "",
													promptN: p.promptN,
													predictedN: p.predictedN,
													promptPerSec: p.promptPerSec,
													predictedPerSec: p.predictedPerSec,
												},
											];
								return { ...prev, slots: updatedSlots };
							});
							setLastUpdated(Date.now());
						}
					} catch {
						// Ignore malformed WS message
					}
				};

				ws.onclose = () => {
					if (disposed) return;
					setWsConnected(false);
					wsRef.current = null;
					startFallbackInterval();
					reconnectTimer = window.setTimeout(connect, 3000);
				};

				ws.onerror = () => {
					ws.close();
				};
			} catch {
				setWsConnected(false);
				startFallbackInterval();
				reconnectTimer = window.setTimeout(connect, 3000);
			}
		};

		// Carga inicial inmediata por HTTP por si el handshake WS demora
		void httpFallbackLoad();
		connect();

		return () => {
			disposed = true;
			stopFallbackInterval();
			if (reconnectTimer) window.clearTimeout(reconnectTimer);
			if (wsRef.current) {
				wsRef.current.close();
				wsRef.current = null;
			}
		};
	}, [enabled, httpFallbackLoad, recordClientPulse]);

	return {
		status,
		health,
		config,
		error,
		loading,
		refresh,
		series,
		clearSeries,
		recordClientPulse,
		pollMs,
		setPollMs,
		paused,
		setPaused,
		lastUpdated,
		wsConnected,
	};
}

export function RuntimeProvider({ children }: { children: ReactNode }) {
	const state = useStandaloneRuntime(false, true);
	return createElement(RuntimeContext.Provider, { value: state }, children);
}

export function useRuntime(skipConfig = false): RuntimeState {
	const ctx = useContext(RuntimeContext);
	const standalone = useStandaloneRuntime(skipConfig, !ctx);
	return ctx ?? standalone;
}
