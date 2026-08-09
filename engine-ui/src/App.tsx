import { useEffect, useRef, useState } from "react";
import type { EngineStatus } from "./api";
import { fetchStatus } from "./api";

const POLL_MS = 3000;

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

function fmtUptime(ms: number): string {
	const s = Math.floor(ms / 1000);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	return `${h}h ${m}m ${sec}s`;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="card">
			<h2>{title}</h2>
			{children}
		</div>
	);
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
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

function VramBar({ used, total }: { used: number; total: number }) {
	const pct = total > 0 ? Math.round((used / total) * 100) : 0;
	return (
		<div className="vram">
			<div className="vram-bar">
				<div className="vram-fill" style={{ width: `${pct}%` }} />
			</div>
			<span className="vram-label">
				{pct}% · {fmtBytes(used * 1024 * 1024)} / {fmtBytes(total * 1024 * 1024)}
			</span>
		</div>
	);
}

function App() {
	const [status, setStatus] = useState<EngineStatus | null>(null);
	const [error, setError] = useState<string | null>(null);
	const timer = useRef<number | null>(null);

	useEffect(() => {
		const load = async () => {
			try {
				setStatus(await fetchStatus());
				setError(null);
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
			}
		};
		load();
		timer.current = window.setInterval(load, POLL_MS);
		return () => {
			if (timer.current) window.clearInterval(timer.current);
		};
	}, []);

	const gpu = status?.gpu;
	const tokPerSec = status?.slots.reduce((a, s) => a + (s.predictedPerSec || 0), 0) || 0;

	return (
		<div className="app">
			<header className="topbar">
				<div className="brand">🦙 llama-engine</div>
				<div className="status-pill">
					<span className={`dot ${status?.runtimeRunning ? "ok" : "down"}`} />
					{status?.runtimeHealthy
						? "runtime ok"
						: status?.runtimeRunning
							? "cargando…"
							: "runtime down"}
				</div>
			</header>

			{error ? <div className="error">Sin conexión con engine-api: {error}</div> : null}

			<div className="grid">
				<Card title="Modelo">
					{status ? (
						<>
							<Stat label="Cargado" value={status.loadedModel || "—"} />
							<Stat label="Modelos registrados" value={String(status.models.length)} />
							<Stat label="Throughput total" value={tokPerSec.toFixed(1)} unit="tok/s" />
							<Stat label="Uptime API" value={fmtUptime(status.apiUptimeMs)} />
						</>
					) : (
						<p className="muted">esperando datos…</p>
					)}
				</Card>

				<Card title="GPU">
					{gpu?.available ? (
						<>
							<Stat label="GPU" value={gpu.name || "—"} />
							<Stat label="Uso" value={gpu.gpuUtilPct !== undefined ? `${gpu.gpuUtilPct}%` : "—"} />
							<Stat
								label="Temperatura"
								value={gpu.temperatureC !== undefined ? `${gpu.temperatureC}°C` : "—"}
							/>
							<Stat
								label="Potencia"
								value={gpu.powerDrawW !== undefined ? `${gpu.powerDrawW.toFixed(0)} W` : "—"}
							/>
							{gpu.vramTotalMiB ? (
								<VramBar used={gpu.vramUsedMiB || 0} total={gpu.vramTotalMiB} />
							) : null}
						</>
					) : (
						<p className="muted">GPU no disponible (sin nvidia-smi)</p>
					)}
				</Card>

				<Card title="Slots (inferencia)">
					{status && status.slots.length > 0 ? (
						<table className="table">
							<thead>
								<tr>
									<th>slot</th>
									<th>prompt tok/s</th>
									<th>gen tok/s</th>
								</tr>
							</thead>
							<tbody>
								{status.slots.map((s) => (
									<tr key={s.id}>
										<td>
											{s.id} · {s.model}
										</td>
										<td>{s.promptPerSec.toFixed(1)}</td>
										<td>{s.predictedPerSec.toFixed(1)}</td>
									</tr>
								))}
							</tbody>
						</table>
					) : (
						<p className="muted">sin inferencia activa</p>
					)}
				</Card>

				<Card title="Modelos GGUF registrados">
					{status && status.models.length > 0 ? (
						<ul className="models">
							{status.models.map((m) => (
								<li key={m.id} className={m.id === status.loadedModel ? "active" : ""}>
									<span className="model-id">{m.id}</span>
									<span className="model-tag">{m.vision ? "vision" : "texto"}</span>
									<span className="model-size">{fmtBytes(m.sizeBytes)}</span>
								</li>
							))}
						</ul>
					) : (
						<p className="muted">sin modelos en {"/models"}</p>
					)}
				</Card>
			</div>

			<footer className="foot">
				<span>motor llama.cpp · telemetría cada {POLL_MS / 1000}s</span>
			</footer>
		</div>
	);
}

export default App;
