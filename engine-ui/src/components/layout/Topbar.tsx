import type { EngineStatus, RuntimeHealth } from "../../api";

export type StatusTone = "ok" | "warn" | "down";

export function statusTone(status: EngineStatus | null, health: RuntimeHealth | null): StatusTone {
	if (!status) return "down";
	if (health?.healthy) return "ok";
	if (status.runtimeRunning || status.runtimeHealthy) return "warn";
	return "down";
}

export function statusLabel(status: EngineStatus | null, health: RuntimeHealth | null): string {
	if (!status) return "runtime down";
	if (health?.healthy) return "runtime ok";
	if (status.runtimeRunning || status.runtimeHealthy) return "cargando…";
	return "runtime down";
}

export function Topbar({
	status,
	health,
	open,
	onToggleSidebar,
}: {
	status: EngineStatus | null;
	health: RuntimeHealth | null;
	open: boolean;
	onToggleSidebar: () => void;
}) {
	const tone = statusTone(status, health);
	return (
		<header className="topbar">
			<button
				type="button"
				className="icon-btn menu-btn"
				onClick={onToggleSidebar}
				aria-label="Abrir menú de navegación"
				aria-expanded={open}
			>
				☰
			</button>
			<div className="topbar-spacer" />
			<div className="status-pill" role="status">
				<span className={`dot ${tone}`} aria-hidden="true" />
				<span>{statusLabel(status, health)}</span>
			</div>
		</header>
	);
}
