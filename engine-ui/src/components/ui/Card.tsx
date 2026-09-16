import type { ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
	return (
		<section className="card">
			{title ? <h2>{title}</h2> : null}
			{children}
		</section>
	);
}

export function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
	return (
		<div className="stat">
			<span className="stat-label">{label}</span>
			<span className="stat-value">
				{value}
				{unit ? <small> {unit}</small> : null}
			</span>
		</div>
	);
}

export function VramBar({ used, total }: { used: number; total: number }) {
	const pct = total > 0 ? Math.round((used / total) * 100) : 0;
	return (
		<div className="vram">
			<div className="vram-track">
				<div className="vram-fill" style={{ "--vram": pct / 100 } as React.CSSProperties} />
			</div>
			<span className="vram-label">
				{pct}% · {fmtBytes(used * 1024 * 1024)} / {fmtBytes(total * 1024 * 1024)}
			</span>
		</div>
	);
}

function fmtBytes(bytes: number): string {
	if (!bytes) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	let v = bytes;
	let i = 0;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}
