import type { ReactNode } from "react";
import { fmtBytes } from "./helpers";

export function Card({
	title,
	action,
	className = "",
	children,
}: {
	title?: string;
	action?: ReactNode;
	className?: string;
	children: ReactNode;
}) {
	return (
		<section className={`card ${className}`.trim()}>
			{title || action ? (
				<div className="card-header">
					{title ? <h2>{title}</h2> : <span />}
					{action ? <div className="card-header-action">{action}</div> : null}
				</div>
			) : null}
			{children}
		</section>
	);
}

export function Stat({
	label,
	value,
	unit,
	tone,
}: {
	label: string;
	value: string;
	unit?: string;
	tone?: "default" | "accent" | "warn" | "danger";
}) {
	return (
		<div className="stat">
			<span className="stat-label">{label}</span>
			<span className={`stat-value ${tone ? `stat-tone-${tone}` : ""}`.trim()}>
				{value}
				{unit ? <small> {unit}</small> : null}
			</span>
		</div>
	);
}

export function VramBar({ used, total }: { used: number; total: number }) {
	const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
	const free = Math.max(0, total - used);
	const toneClass = pct >= 90 ? "vram-fill-danger" : pct >= 78 ? "vram-fill-warn" : "";

	return (
		<div className="vram">
			<div className="vram-head">
				<span className="vram-pct">{pct}% VRAM en uso</span>
				<span className="vram-free">{fmtBytes(free * 1024 * 1024)} libres</span>
			</div>
			<div className="vram-track">
				<div
					className={`vram-fill ${toneClass}`.trim()}
					style={{ "--vram": pct / 100 } as React.CSSProperties}
				/>
			</div>
			<span className="vram-label">
				{fmtBytes(used * 1024 * 1024)} usados de {fmtBytes(total * 1024 * 1024)} ({used} / {total}{" "}
				MiB)
			</span>
		</div>
	);
}
