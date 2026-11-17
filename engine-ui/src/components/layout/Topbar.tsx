import { Link, useLocation } from "react-router-dom";
import type { EngineStatus, RuntimeHealth } from "../../api";
import { useTheme } from "../../context/ThemeContext";
import { useRuntime } from "../../hooks/useRuntime";
import {
	IconBolt,
	IconCpu,
	IconGauge,
	IconMenu,
	IconMoon,
	IconPause,
	IconPlay,
	IconRefresh,
	IconSearch,
	IconSettings,
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
	playground: "Playground Studio",
	test: "Test & Benchmark",
	modelos: "Modelos GGUF",
	crear: "Asistente de Modelos",
	datasets: "DataSets",
	runtime: "Runtime & Logs",
	telemetria: "Telemetría",
	configuracion: "Configuración",
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
	const { refresh, paused, setPaused, pollMs, setPollMs, wsConnected } = useRuntime();
	const tone = statusTone(status, health);

	const segments = location.pathname.split("/").filter(Boolean);
	const currentLabel =
		segments.length === 0
			? "Dashboard"
			: (ROUTE_LABELS[segments[segments.length - 1]] ?? segments[segments.length - 1]);

	const activeCtx = health?.ctxSize ?? status?.ctxSize;
	const cleanGpuName = status?.gpu.name?.replace(/^[^\x20-\x7E]+/, "").trim() || "NVIDIA GPU";
	const liveTokPerSec = status?.slots.reduce((a, s) => a + (s.predictedPerSec || 0), 0) ?? 0;
	const gpu = status?.gpu;

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

			{gpu?.available && gpu.vramTotalMiB ? (
				<Link
					to="/telemetria"
					className="topbar-gpu-chip"
					title={`GPU: ${cleanGpuName} · VRAM ${gpu.vramUsedMiB ?? 0}/${gpu.vramTotalMiB} MiB · ${gpu.temperatureC ?? "—"}°C`}
				>
					<span className="mono">
						{((gpu.vramUsedMiB ?? 0) / 1024).toFixed(1)}/{(gpu.vramTotalMiB / 1024).toFixed(0)}G
					</span>
					{gpu.temperatureC !== undefined ? (
						<span
							className={`topbar-temp ${gpu.temperatureC >= 78 ? "hot" : ""}`}
						>{`${gpu.temperatureC}°C`}</span>
					) : null}
					{liveTokPerSec > 0 ? (
						<span className="topbar-tok">
							<IconBolt size={11} />
							{liveTokPerSec.toFixed(1)}
						</span>
					) : null}
				</Link>
			) : null}

			{status?.loadedModel ? (
				<Link
					to="/modelos"
					className="topbar-model-pill"
					title={`Modelo cargado: ${status.loadedModel}${activeCtx ? ` · ctx ${activeCtx}` : ""}`}
				>
					<IconCpu size={14} />
					<span className="mono">{status.loadedModel}</span>
					{activeCtx ? (
						<span className="topbar-ctx-tag">{Math.round(activeCtx / 1024)}K</span>
					) : null}
				</Link>
			) : null}

			<div className="topbar-controls">
				<Link
					to="/test"
					className="icon-btn"
					title="Ir a Test & Benchmark del modelo"
					aria-label="Test & Benchmark"
				>
					<IconGauge size={15} />
				</Link>

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
					<option value="2000">Poll 2s</option>
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

				<Link
					to="/configuracion"
					className="icon-btn"
					title="Configuración y personalización"
					aria-label="Configuración"
				>
					<IconSettings size={15} />
				</Link>
			</div>

			<div
				className={`status-pill status-pill-${tone}`}
				role="status"
				title={wsConnected ? "Conectado por WebSocket (/api/ws)" : "Modo HTTP Polling"}
			>
				<span className={`dot ${tone}`} aria-hidden="true" />
				<span>{statusLabel(status, health)}</span>
				{wsConnected ? <span className="topbar-ctx-tag">WS</span> : null}
			</div>
		</header>
	);
}
