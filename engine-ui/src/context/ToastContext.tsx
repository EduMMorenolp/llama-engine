import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { IconAlert, IconCheck, IconInfo, IconX } from "../components/ui/Icons";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastItem {
	id: string;
	tone: ToastTone;
	title: string;
	message?: string;
}

export interface ToastContextValue {
	toasts: ToastItem[];
	pushToast: (toast: Omit<ToastItem, "id">, durationMs?: number) => void;
	dismissToast: (id: string) => void;
	success: (title: string, message?: string) => void;
	error: (title: string, message?: string) => void;
	warning: (title: string, message?: string) => void;
	info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<ToastItem[]>([]);

	const dismissToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	const pushToast = useCallback(
		(toast: Omit<ToastItem, "id">, durationMs = 4200) => {
			const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
			setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
			if (durationMs > 0) {
				window.setTimeout(() => {
					dismissToast(id);
				}, durationMs);
			}
		},
		[dismissToast],
	);

	const success = useCallback(
		(title: string, message?: string) => pushToast({ tone: "success", title, message }),
		[pushToast],
	);
	const error = useCallback(
		(title: string, message?: string) => pushToast({ tone: "error", title, message }, 6000),
		[pushToast],
	);
	const warning = useCallback(
		(title: string, message?: string) => pushToast({ tone: "warning", title, message }),
		[pushToast],
	);
	const info = useCallback(
		(title: string, message?: string) => pushToast({ tone: "info", title, message }),
		[pushToast],
	);

	return (
		<ToastContext.Provider
			value={{ toasts, pushToast, dismissToast, success, error, warning, info }}
		>
			{children}
			<section className="toast-viewport" aria-label="Notificaciones" aria-live="polite">
				{toasts.map((t) => (
					<div key={t.id} className={`toast-card toast-${t.tone}`} role="status">
						<div className="toast-icon">
							{t.tone === "success" && <IconCheck size={16} />}
							{t.tone === "error" && <IconAlert size={16} />}
							{t.tone === "warning" && <IconAlert size={16} />}
							{t.tone === "info" && <IconInfo size={16} />}
						</div>
						<div className="toast-body">
							<div className="toast-title">{t.title}</div>
							{t.message ? <div className="toast-msg">{t.message}</div> : null}
						</div>
						<button
							type="button"
							className="toast-close"
							onClick={() => dismissToast(t.id)}
							aria-label="Cerrar notificación"
						>
							<IconX size={14} />
						</button>
					</div>
				))}
			</section>
		</ToastContext.Provider>
	);
}

const NOOP_TOAST: ToastContextValue = {
	toasts: [],
	pushToast: () => {},
	dismissToast: () => {},
	success: () => {},
	error: () => {},
	warning: () => {},
	info: () => {},
};

export function useToast(): ToastContextValue {
	return useContext(ToastContext) ?? NOOP_TOAST;
}
