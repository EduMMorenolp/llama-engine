import { Link, useLocation } from "react-router-dom";
import type { EngineStatus, RuntimeHealth } from "../../api";
import { useTheme } from "../../context/ThemeContext";
import { useRuntime } from "../../hooks/useRuntime";
import {
	IconCpu,
	IconMenu,
	IconMoon,
	IconPause,
	IconPlay,
	IconRefresh,
	IconSearch,
	IconSun,
} from "../ui/Icons";

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

const ROUTE_LABELS: Record<string, string> = {
	"": "Dashboard",
	playground: "Playground",
	modelos: "Modelos GGUF",
	crear: "Asistente de Modelos",
	datasets: "DataSets",
	runtime: "Runtime & Logs",
	telemetria: "Telemetría",
	ayuda: "Ayuda & API",
};

export function Topbar({
	status,
	health,
	open,
	onToggleSidebar,
	onOpenPalette,
}: {
	status: EngineStatus | null;
	health: RuntimeHealth | null;
	open: boolean;
	onToggleSidebar: () => void;
	onOpenPalette?: () => void;
}) {
	const location = useLocation();
	const { theme, toggleTheme } = useTheme();
	const { refresh, paused, setPaused, pollMs, setPollMs } = useRuntime();
	const tone = statusTone(status, health);

	const segments = location.pathname.split("/").filter(Boolean);
	const currentLabel =
		segments.length === 0
			? "Dashboard"
			: (ROUTE_LABELS[segments[segments.length - 1]] ?? segments[segments.length - 1]);

	return (
		<header className="topbar">
			<button
				type="button"
				className="icon-btn menu-btn"
				onClick={onToggleSidebar}
				aria-label="Abrir menú de navegación"
				aria-expanded={open}
			>
				<IconMenu size={18} />
			</button>

			<nav className="breadcrumbs" aria-label="Ruta de navegación">
				<Link to="/" className="breadcrumb-root">
					llama-engine
				</Link>
				<span className="breadcrumb-sep" aria-hidden="true">
					/
				</span>
				{segments.length > 1 ? (
					<>
						<Link to={`/${segments[0]}`} className="breadcrumb-link">
							{ROUTE_LABELS[segments[0]] ?? segments[0]}
						</Link>
						<span className="breadcrumb-sep" aria-hidden="true">
							/
						</span>
					</>
				) : null}
				<span className="breadcrumb-current" aria-current="page">
					{currentLabel}
				</span>
			</nav>

			<div className="topbar-spacer" />

			{onOpenPalette ? (
				<button
					type="button"
					className="topbar-cmd-trigger"
					onClick={onOpenPalette}
					title="Abrir paleta de comandos (Ctrl+K)"
				>
					<IconSearch size={14} />
					<span className="topbar-cmd-text">Comandos y modelos…</span>
					<kbd className="kbd">Ctrl K</kbd>
				</button>
			) : null}

			{status?.loadedModel ? (
				<Link
					to="/modelos"
					className="topbar-model-pill"
					title={`Modelo cargado: ${status.loadedModel}${health?.ctxSize ? ` · ctx ${health.ctxSize}` : ""}`}
				>
					<IconCpu size={14} />
					<span className="mono">{status.loadedModel}</span>
					{health?.ctxSize ? (
						<span className="topbar-ctx-tag">{Math.round(health.ctxSize / 1024)}K</span>
					) : null}
				</Link>
			) : null}

			<div className="topbar-controls">
				<select
					className="topbar-poll-select"
					aria-label="Intervalo de actualización"
					value={paused ? "paused" : String(pollMs)}
					onChange={(e) => {
						const v = e.target.value;
						if (v === "paused") {
							setPaused(true);
						} else {
							setPaused(false);
							setPollMs(Number(v));
						}
					}}
				>
					<option value="3000">Poll 3s</option>
					<option value="5000">Poll 5s</option>
					<option value="10000">Poll 10s</option>
					<option value="paused">Pausado</option>
				</select>

				<button
					type="button"
					className="icon-btn"
					onClick={() => setPaused(!paused)}
					title={paused ? "Reanudar telemetría en vivo" : "Pausar telemetría en vivo"}
					aria-label={paused ? "Reanudar telemetría" : "Pausar telemetría"}
				>
					{paused ? <IconPlay size={15} /> : <IconPause size={15} />}
				</button>

				<button
					type="button"
					className="icon-btn"
					onClick={refresh}
					title="Actualizar estado ahora"
					aria-label="Actualizar estado ahora"
				>
					<IconRefresh size={15} />
				</button>

				<button
					type="button"
					className="icon-btn"
					onClick={toggleTheme}
					title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
					aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
				>
					{theme === "dark" ? <IconSun size={15} /> : <IconMoon size={15} />}
				</button>
			</div>

			<div className={`status-pill status-pill-${tone}`} role="status">
				<span className={`dot ${tone}`} aria-hidden="true" />
				<span>{statusLabel(status, health)}</span>
			</div>
		</header>
	);
}
