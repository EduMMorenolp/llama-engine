import { useState } from "react";
import { Outlet } from "react-router-dom";
import { POLL_MS, useRuntime } from "../../hooks/useRuntime";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function Layout() {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const { status, health, error, loading } = useRuntime();

	return (
		<div className="layout">
			<Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
			<div className="shell">
				<Topbar
					status={status}
					health={health}
					open={sidebarOpen}
					onToggleSidebar={() => setSidebarOpen((v) => !v)}
				/>
				{error ? (
					<div className="error" role="alert">
						Sin conexión con engine-api: {error}
					</div>
				) : null}
				<main className="page">
					<Outlet />
				</main>
				<footer className="foot">
					<span>
						{loading ? "conectando…" : `motor llama.cpp · telemetría cada ${POLL_MS / 1000}s`}
					</span>
				</footer>
			</div>
		</div>
	);
}
