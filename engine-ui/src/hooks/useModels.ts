import { useCallback, useState } from "react";
import type { ActionResult, RegisteredModel, ReloadOptions } from "../api";
import { reloadModel, restartRuntime, startRuntime, stopRuntime } from "../api";
import { useToast } from "../context/ToastContext";

export type BusyAction = "reload" | "restart" | "stop" | "start" | null;

export interface ModelActions {
	busyAction: BusyAction;
	error: string | null;
	message: string | null;
	reload: (modelId: string, opts?: number | ReloadOptions) => void;
	restart: () => void;
	stop: () => void;
	start: () => void;
}

/**
 * Handles runtime actions (reload/restart/stop/start) with a single busy
 * state so only one action runs at a time, plus inline error/message feedback
 * and global toast notifications.
 */
export function useModels(_registry: RegisteredModel[], refresh: () => void): ModelActions {
	const [busyAction, setBusyAction] = useState<BusyAction>(null);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const toast = useToast();

	const run = useCallback(
		async (action: BusyAction, label: string, fn: () => Promise<ActionResult>) => {
			setBusyAction(action);
			setError(null);
			setMessage(null);
			try {
				const res = await fn();
				const msg = res.message ?? `${label} completado`;
				setMessage(msg);
				toast.success(label, msg);
				refresh();
			} catch (err) {
				const errMsg = err instanceof Error ? err.message : String(err);
				setError(errMsg);
				toast.error(`Error al ${label.toLowerCase()}`, errMsg);
			} finally {
				setBusyAction(null);
			}
		},
		[refresh, toast],
	);

	return {
		busyAction,
		error,
		message,
		reload: useCallback(
			(modelId, ctxSize) =>
				run("reload", `Recargar ${modelId}`, () => reloadModel(modelId, ctxSize)),
			[run],
		),
		restart: useCallback(() => run("restart", "Reiniciar runtime", restartRuntime), [run]),
		stop: useCallback(() => run("stop", "Detener runtime", stopRuntime), [run]),
		start: useCallback(() => run("start", "Iniciar runtime", startRuntime), [run]),
	};
}
