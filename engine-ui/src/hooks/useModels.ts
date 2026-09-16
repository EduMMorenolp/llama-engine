import { useCallback, useState } from "react";
import type { ActionResult, RegisteredModel } from "../api";
import { reloadModel, restartRuntime, startRuntime, stopRuntime } from "../api";

export type BusyAction = "reload" | "restart" | "stop" | "start" | null;

export interface ModelActions {
	busyAction: BusyAction;
	error: string | null;
	message: string | null;
	reload: (modelId: string, ctxSize?: number) => void;
	restart: () => void;
	stop: () => void;
	start: () => void;
}

/**
 * Handles runtime actions (reload/restart/stop/start) with a single busy
 * state so only one action runs at a time, plus inline error/message feedback.
 * Pass `refresh` from useRuntime to re-poll after each successful call.
 */
export function useModels(_registry: RegisteredModel[], refresh: () => void): ModelActions {
	const [busyAction, setBusyAction] = useState<BusyAction>(null);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const run = useCallback(
		async (action: BusyAction, fn: () => Promise<ActionResult>) => {
			setBusyAction(action);
			setError(null);
			setMessage(null);
			try {
				const res = await fn();
				if (res.message) setMessage(res.message);
				refresh();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusyAction(null);
			}
		},
		[refresh],
	);

	return {
		busyAction,
		error,
		message,
		reload: useCallback(
			(modelId, ctxSize) => run("reload", () => reloadModel(modelId, ctxSize)),
			[run],
		),
		restart: useCallback(() => run("restart", restartRuntime), [run]),
		stop: useCallback(() => run("stop", stopRuntime), [run]),
		start: useCallback(() => run("start", startRuntime), [run]),
	};
}
