import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { RuntimeProvider, useRuntime } from "../../hooks/useRuntime";
import { ONBOARDING_STORAGE_KEY, OnboardingModal } from "../onboarding/OnboardingModal";
import { CommandPalette } from "../ui/CommandPalette";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { fmtTime } from "../ui/helpers";
import { IconAlert, IconRefresh } from "../ui/Icons";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

function LayoutInner() {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [showTour, setShowTour] = useState(() => {
		try {
			return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "true";
		} catch {
			return false;
		}
	});
	const { status, health, error, loading, refresh, pollMs, paused, lastUpdated, wsConnected } =
		useRuntime();

	useEffect(() => {
		const handleOpenTour = () => setShowTour(true);
		window.addEventListener("llama-engine-open-tour", handleOpenTour);
		return () => window.removeEventListener("llama-engine-open-tour", handleOpenTour);
	}, []);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setPaletteOpen((prev) => !prev);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	return (
		<div className="layout">
			<a href="#main-content" className="skip-link">
				Saltar al contenido principal
			</a>
			<Sidebar
				open={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				onOpenPalette={() => setPaletteOpen(true)}
			/>
			<div className="shell">
				<Topbar
					status={status}
					health={health}
					open={sidebarOpen}
					onToggleSidebar={() => setSidebarOpen((v) => !v)}
					onOpenPalette={() => setPaletteOpen(true)}
				/>
				{error ? (
					<div className="error" role="alert">
						<div className="error-main">
							<IconAlert size={16} />
							<span>Sin conexión con engine-api: {error}</span>
						</div>
						<button type="button" className="btn btn-ghost btn-sm" onClick={refresh}>
							<IconRefresh size={14} />
							<span>Reintentar</span>
						</button>
					</div>
				) : null}
				<main id="main-content" className="page">
					<ErrorBoundary>
						<Outlet />
					</ErrorBoundary>
				</main>
				<footer className="foot">
					<span>
						{loading
							? "conectando…"
							: paused
								? "motor llama.cpp · telemetría en pausa"
								: wsConnected
									? `motor llama.cpp · ⚡ WebSocket Live (${pollMs / 1000}s)`
									: `motor llama.cpp · HTTP Poll (${pollMs / 1000}s)`}
					</span>
					{lastUpdated ? (
						<span className="foot-sep">· actualizado {fmtTime(lastUpdated)}</span>
					) : null}
				</footer>
			</div>
			<CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
			<OnboardingModal isOpen={showTour} onClose={() => setShowTour(false)} />
		</div>
	);
}

export function Layout() {
	return (
		<RuntimeProvider>
			<LayoutInner />
		</RuntimeProvider>
	);
}
