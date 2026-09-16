import {
	CategoryScale,
	Chart as ChartJS,
	Filler,
	LinearScale,
	LineElement,
	PointElement,
	Tooltip,
} from "chart.js";
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { useRuntime } from "../../hooks/useRuntime";
import { APP_VERSION } from "../../info";
import { Card, Stat, VramBar } from "../ui/Card";
import { fmtTime, fmtUptime } from "../ui/helpers";
import { PageHeader, PageSection } from "../ui/PageHeader";
import { ErrorState, Loading } from "../ui/states";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const MAX_POINTS = 60;
const ACCENT = "#34d399";
const ACCENT_FILL = "rgba(52, 211, 153, 0.12)";

interface Point {
	t: number;
	tok: number;
}

export function TelemetryPage() {
	const { status, error, loading, refresh } = useRuntime(true);
	const [series, setSeries] = useState<Point[]>([]);

	useEffect(() => {
		if (!status) return;
		const tok = status.slots.reduce((a, s) => a + (s.predictedPerSec || 0), 0);
		setSeries((prev) => {
			const next = [...prev, { t: Date.now(), tok }];
			return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
		});
	}, [status]);

	if (loading) return <Loading />;
	if (error && !status) return <ErrorState error={error} onRetry={refresh} />;

	const gpu = status?.gpu;
	const current = series.length ? series[series.length - 1].tok : 0;

	const data = {
		labels: series.map((p) => fmtTime(p.t)),
		datasets: [
			{
				label: "tok/s",
				data: series.map((p) => p.tok),
				borderColor: ACCENT,
				backgroundColor: ACCENT_FILL,
				fill: true,
				tension: 0.3,
				pointRadius: 0,
			},
		],
	};

	return (
		<div className="page-stack">
			<PageHeader
				title="Telemetría"
				description="Sistema, GPU y throughput acumulado de la sesión"
			/>

			<div className="grid grid-2">
				<Card title="Sistema">
					<Stat label="Versión" value={`v${APP_VERSION}`} />
					<Stat label="Uptime API" value={status ? fmtUptime(status.apiUptimeMs) : "—"} />
					<Stat label="Modelo cargado" value={status?.loadedModel || "—"} />
					<Stat label="Modelos" value={status ? String(status.models.length) : "—"} />
					<Stat label="GPU" value={gpu?.available ? gpu.name || "—" : "no disponible"} />
					<Stat
						label="VRAM"
						value={gpu?.available ? `${gpu.vramUsedMiB} / ${gpu.vramTotalMiB} MiB` : "—"}
					/>
					<p className="specs-note">
						Motor llama.cpp · backend CUDA (Blackwell) · API OpenAI-compatible
					</p>
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
			</div>

			<PageSection title="Recorrido tok/s">
				<p className="stat">
					<span className="stat-label">Último valor</span>
					<span className="stat-value">{current.toFixed(1)} tok/s</span>
				</p>
				<p className="muted small">
					Serie acumulada de hasta {MAX_POINTS} muestras de telemetría (poll cada 3s).
				</p>
				<div className="chart-wrap">
					{series.length > 1 ? (
						<Line
							data={data}
							options={{
								responsive: true,
								maintainAspectRatio: false,
								scales: {
									x: { ticks: { maxTicksLimit: 8, color: "#8b93a7" } },
									y: { ticks: { color: "#8b93a7" } },
								},
								plugins: {
									legend: { display: false },
								},
							}}
						/>
					) : (
						<p className="muted">acumulando muestras…</p>
					)}
				</div>
			</PageSection>
		</div>
	);
}
