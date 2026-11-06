import type { ReactNode } from "react";
import { IconAlert, IconRefresh } from "./Icons";

export function Loading() {
	return (
		<div className="loading" role="status" aria-busy="true" aria-label="Cargando datos">
			<div className="skeleton skeleton-hero" />
			<div className="skeleton-grid">
				<div className="skeleton skeleton-tile" />
				<div className="skeleton skeleton-tile" />
				<div className="skeleton skeleton-tile" />
				<div className="skeleton skeleton-tile" />
			</div>
			<div className="skeleton skeleton-panel" />
		</div>
	);
}

export function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
	return (
		<div className="state-box state-error" role="alert">
			<div className="state-box-head">
				<IconAlert size={20} />
				<p className="state-title">Sin conexión con engine-api</p>
			</div>
			<p className="muted">{error}</p>
			{onRetry ? (
				<div className="action-row" style={{ marginTop: 12 }}>
					<button type="button" className="btn btn-default btn-sm" onClick={onRetry}>
						<IconRefresh size={14} />
						<span>Reintentar conexión</span>
					</button>
				</div>
			) : null}
		</div>
	);
}

export function EmptyState({
	message,
	title,
	icon,
	action,
}: {
	message: string;
	title?: string;
	icon?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div className="empty-state-box" role="status">
			{icon ? <div className="empty-state-icon">{icon}</div> : null}
			{title ? <h3 className="empty-state-title">{title}</h3> : null}
			<p className="muted">{message}</p>
			{action ? <div className="empty-state-action">{action}</div> : null}
		</div>
	);
}
