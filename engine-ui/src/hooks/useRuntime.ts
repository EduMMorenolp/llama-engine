import { useCallback, useEffect, useRef, useState } from "react";
import type { EngineStatus, RuntimeConfig, RuntimeHealth } from "../api";
import { fetchRuntimeConfig, fetchRuntimeHealth, fetchStatus } from "../api";

export const POLL_MS = 3000;

export interface RuntimeState {
	status: EngineStatus | null;
	health: RuntimeHealth | null;
	config: RuntimeConfig | null;
	error: string | null;
	loading: boolean;
	refresh: () => void;
}

export function useRuntime(skipConfig = false): RuntimeState {
	const [status, setStatus] = useState<EngineStatus | null>(null);
	const [health, setHealth] = useState<RuntimeHealth | null>(null);
	const [config, setConfig] = useState<RuntimeConfig | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const loadRef = useRef<(() => Promise<void>) | null>(null);

	useEffect(() => {
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
				setHealth(h ?? null);
				setConfig(c ?? null);
				setError(null);
			} catch (e) {
				if (cancelled) return;
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				if (!cancelled) setLoading(false);
			}
		};

		loadRef.current = load;
		load();
		timer = window.setInterval(load, POLL_MS);
		return () => {
			cancelled = true;
			if (timer) window.clearInterval(timer);
		};
	}, [skipConfig]);

	const refresh = useCallback(() => {
		const load = loadRef.current;
		if (load) void load();
	}, []);

	return { status, health, config, error, loading, refresh };
}
