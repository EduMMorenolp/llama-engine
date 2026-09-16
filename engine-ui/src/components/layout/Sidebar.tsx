import { NavLink } from "react-router-dom";
import { APP_VERSION } from "../../info";

const NAV_ITEMS = [
	{ to: "/", label: "Dashboard", end: true },
	{ to: "/modelos", label: "Modelos", end: false },
	{ to: "/modelos/crear", label: "Crear Modelo", end: false },
	{ to: "/runtime", label: "Runtime", end: false },
	{ to: "/telemetria", label: "Telemetría", end: false },
	{ to: "/ayuda", label: "Ayuda", end: false },
];

function bulletFor(path: string): string {
	switch (path) {
		case "/":
			return "⌂";
		case "/modelos":
			return "▤";
		case "/modelos/crear":
			return "✦";
		case "/runtime":
			return "⚙";
		case "/telemetria":
			return "◔";
		default:
			return "?";
	}
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
	return (
		<>
			<div
				className={`sidebar-overlay ${open ? "visible" : ""}`}
				onClick={onClose}
				aria-hidden="true"
			/>
			<aside className={`sidebar ${open ? "open" : ""}`} aria-label="Navegación principal">
				<div className="sidebar-brand">
					<span className="brand-mark" aria-hidden="true">
						🦙
					</span>
					<span className="brand-name">llama-engine</span>
				</div>
				<nav className="sidebar-nav">
					<ul>
						{NAV_ITEMS.map((item) => (
							<li key={item.to}>
								<NavLink to={item.to} end={item.end} onClick={onClose}>
									<span className="nav-glyph" aria-hidden="true">
										{bulletFor(item.to)}
									</span>
									<span>{item.label}</span>
								</NavLink>
							</li>
						))}
					</ul>
				</nav>
				<footer className="sidebar-foot">
					<span className="muted">v{APP_VERSION}</span>
				</footer>
			</aside>
		</>
	);
}
