import { useState } from "react";
import { Outlet } from "react-router-dom";
import { SessionList } from "../../features/sessions/components/SessionList.tsx";

export function Layout() {
	const [sidebarOpen, setSidebarOpen] = useState(true);

	const toggleSidebar = () => {
		setSidebarOpen((prev) => !prev);
	};

	return (
		<div className="layout">
			<aside className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
				<SessionList onToggleSidebar={toggleSidebar} isSidebarOpen={sidebarOpen} />
			</aside>
			<button
				type="button"
				className="sidebar-overlay"
				onClick={() => setSidebarOpen(false)}
				aria-label="Cerrar barra lateral"
			/>
			<main className="main">
				<Outlet context={{ sidebarOpen, toggleSidebar }} />
			</main>
		</div>
	);
}
