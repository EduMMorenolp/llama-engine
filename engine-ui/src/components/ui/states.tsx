export function Loading() {
	return (
		<div className="loading" role="status" aria-busy="true" aria-label="Cargando datos">
			<div className="skeleton" />
			<div className="skeleton" />
			<div className="skeleton" />
		</div>
	);
}

export function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
	return (
		<div className="state-box state-error" role="alert">
			<p className="state-title">Sin conexión con engine-api</p>
			<p>{error}</p>
			{onRetry ? (
				<button type="button" className="btn btn-ghost" onClick={onRetry}>
					Reintentar
				</button>
			) : null}
		</div>
	);
}

export function EmptyState({ message }: { message: string }) {
	return (
		<p className="muted" role="status">
			{message}
		</p>
	);
}
