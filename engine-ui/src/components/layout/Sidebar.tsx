import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useRuntime } from "../../hooks/useRuntime";
import { APP_VERSION } from "../../info";
import {
	IconActivity,
	IconCpu,
	IconDashboard,
	IconDatabase,
	IconHelp,
	IconModels,
	IconPlayground,
	IconSearch,
	IconSparkles,
} from "../ui/Icons";
import { statusLabel, statusTone } from "./Topbar";

interface NavItem {
	to: string;
	label: string;
	end: boolean;
	badge?: string;
	icon: ReactNode;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
	{
		title: "Principal",
		items: [
			{ to: "/", label: "Dashboard", end: true, icon: <IconDashboard size={17} /> },
			{
				to: "/playground",
				label: "Playground",
				end: false,
				badge: "SSE",
				icon: <IconPlayground size={17} />,
			},
			{ to: "/telemetria", label: "Telemetría", end: false, icon: <IconActivity size={17} /> },
		],
	},
	{
		title: "Modelos & Fine-Tuning",
		items: [
			{ to: "/modelos", label: "Modelos GGUF", end: false, icon: <IconModels size={17} /> },
			{
				to: "/modelos/crear",
				label: "Crear / Quantizar",
				end: false,
				icon: <IconSparkles size={17} />,
			},
			{ to: "/datasets", label: "DataSets", end: false, icon: <IconDatabase size={17} /> },
		],
	},
	{
		title: "Sistema",
		items: [
			{ to: "/runtime", label: "Runtime & Logs", end: false, icon: <IconCpu size={17} /> },
			{ to: "/ayuda", label: "Ayuda & API", end: false, icon: <IconHelp size={17} /> },
		],
	},
];

export function Sidebar({
	open,
	onClose,
	onOpenPalette,
}: {
	open: boolean;
	onClose: () => void;
	onOpenPalette?: () => void;
}) {
	const { status, health } = useRuntime();
	const tone = statusTone(status, health);
	const vramPct =
		status?.gpu.available && status.gpu.vramTotalMiB
			? Math.round(((status.gpu.vramUsedMiB ?? 0) / status.gpu.vramTotalMiB) * 100)
			: null;

	return (
		<>
			<div
				className={`sidebar-overlay ${open ? "visible" : ""}`}
				onClick={onClose}
				aria-hidden="true"
			/>
			<aside className={`sidebar ${open ? "open" : ""}`} aria-label="Navegación principal">
				<div className="sidebar-brand">
					<div className="brand-logo" aria-hidden="true">
						🦙
					</div>
					<div className="brand-text">
						<span className="brand-name">llama-engine</span>
						<span className="brand-sub">CUDA 12.8 · sm_120</span>
					</div>
				</div>

				{onOpenPalette ? (
					<button
						type="button"
						className="sidebar-search-btn"
						onClick={() => {
							onClose();
							onOpenPalette();
						}}
						aria-label="Abrir paleta de comandos (Ctrl+K)"
					>
						<IconSearch size={14} />
						<span>Buscar acción…</span>
						<kbd className="kbd">Ctrl K</kbd>
					</button>
				) : null}

				<nav className="sidebar-nav">
					{NAV_GROUPS.map((group) => (
						<div key={group.title} className="sidebar-group">
							<div className="sidebar-group-label">{group.title}</div>
							<ul>
								{group.items.map((item) => (
									<li key={item.to}>
										<NavLink to={item.to} end={item.end} onClick={onClose}>
											<span className="nav-glyph">{item.icon}</span>
											<span className="nav-label">{item.label}</span>
											{item.badge ? <span className="nav-badge">{item.badge}</span> : null}
										</NavLink>
									</li>
								))}
							</ul>
						</div>
					))}
				</nav>

				<div className="sidebar-runtime-card">
					<div className="sidebar-runtime-row">
						<span className={`dot ${tone}`} aria-hidden="true" />
						<span className="sidebar-runtime-status">{statusLabel(status, health)}</span>
						{vramPct !== null ? <span className="sidebar-vram-pct">{vramPct}% VRAM</span> : null}
					</div>
					<div className="sidebar-runtime-model" title={status?.loadedModel || "Sin modelo activo"}>
						{status?.loadedModel || "Sin modelo cargado"}
					</div>
					{vramPct !== null ? (
						<div className="sidebar-mini-bar">
							<div className="sidebar-mini-fill" style={{ width: `${Math.min(100, vramPct)}%` }} />
						</div>
					) : null}
				</div>

				<footer className="sidebar-foot">
					<span className="muted">v{APP_VERSION}</span>
					<span className="muted">OpenAI /v1</span>
				</footer>
			</aside>
		</>
	);
}
