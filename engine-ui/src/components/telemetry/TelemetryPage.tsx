import {
	CategoryScale,
	Chart as ChartJS,
	Filler,
	Legend,
	LinearScale,
	LineElement,
	PointElement,
	Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useNavigate } from "react-router-dom";
import { useRuntime } from "../../hooks/useRuntime";
import { APP_VERSION } from "../../info";
import { Button } from "../ui/Button";
import { Card, Stat, VramBar } from "../ui/Card";
import { fmtTime, fmtUptime } from "../ui/helpers";
import { IconDownload, IconGauge } from "../ui/Icons";
import { PageHeader, PageSection } from "../ui/PageHeader";
import { ErrorState, Loading } from "../ui/states";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend);

const ACCENT = "#34d399";
const ACCENT_FILL = "rgba(52, 211, 153, 0.12)";
const INFO = "#60a5fa";
const WARN = "#fbbf24";

export function TelemetryPage() {
	const navigate = useNavigate();
	const { status, health, series, error, loading, refresh } = useRuntime();

	if (loading) return <Loading />;
	if (error && !status) return <ErrorState error={error} onRetry={refresh} />;

	const handleExportCsv = () => {
		if (series.length === 0) return;
		const header =
			"timestamp,time,gen_tok_s,prompt_tok_s,gpu_util_pct,vram_used_mib,temp_c,power_w";
		const rows = series.map(
			(p) =>
				`${p.t},${fmtTime(p.t)},${p.tok.toFixed(2)},${p.promptTok.toFixed(2)},${p.gpuUtil},${p.vramUsedMiB},${p.tempC},${p.powerW.toFixed(1)}`,
		);
		const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `telemetria-${status?.loadedModel || "gpu"}-${Date.now()}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const gpu = status?.gpu;
	const slots = status?.slots ?? [];
	const current = series.length ? series[series.length - 1].tok : 0;
	const peakTok = series.reduce((max, p) => Math.max(max, p.tok), 0);
	const efficiencyTokPerWatt =
		gpu?.powerDrawW && gpu.powerDrawW > 0 && current > 0
			? (current / gpu.powerDrawW).toFixed(2)
			: "—";

	const throughputData = {
		labels: series.map((p) => fmtTime(p.t)),
		datasets: [
			{
				label: "Generación (tok/s)",
				data: series.map((p) => p.tok),
				borderColor: ACCENT,
				backgroundColor: ACCENT_FILL,
				fill: true,
				tension: 0.3,
				pointRadius: 0,
			},
			{
				label: "Prompt Prefill (tok/s)",
				data: series.map((p) => p.promptTok),
				borderColor: INFO,
				backgroundColor: "transparent",
				fill: false,
				tension: 0.3,
				pointRadius: 0,
				borderDash: [4, 4],
			},
		],
	};

	const gpuChartData = {
		labels: series.map((p) => fmtTime(p.t)),
		datasets: [
			{
				label: "GPU Util (%)",
				data: series.map((p) => p.gpuUtil),
				borderColor: INFO,
				backgroundColor: "rgba(96, 165, 250, 0.12)",
				fill: true,
				tension: 0.3,
				pointRadius: 0,
			},
			{
				label: "Temp (°C)",
				data: series.map((p) => p.tempC),
				borderColor: WARN,
				backgroundColor: "transparent",
				fill: false,
				tension: 0.3,
				pointRadius: 0,
			},
		],
	};

	return (
		<div className="page-stack">
			<PageHeader
				title="Telemetría"
				description="Sistema, sensores GPU NVIDIA, slots concurrentes y curvas de throughput de la sesión"
				badge={`${series.length} muestras`}
				actions={
					<div className="action-row">
						<Button
							variant="ghost"
							size="sm"
							onClick={handleExportCsv}
							disabled={series.length === 0}
						>
							<IconDownload size={14} />
							<span>Exportar CSV</span>
						</Button>
						<Button variant="primary" size="sm" onClick={() => navigate("/test")}>
							<IconGauge size={14} />
							<span>Ir a Test & Benchmark</span>
						</Button>
					</div>
				}
			/>

			<div className="grid grid-2">
				<Card title="Sistema">
					<Stat label="Versión" value={`v${APP_VERSION}`} />
					<Stat label="Uptime API" value={status ? fmtUptime(status.apiUptimeMs) : "—"} />
					<Stat label="Modelo cargado" value={status?.loadedModel || "—"} />
					<Stat
						label="Ventana de contexto"
						value={health?.ctxSize ? `${health.ctxSize.toLocaleString()} tokens` : "—"}
					/>
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
								tone={
									gpu.temperatureC && gpu.temperatureC >= 80
										? "danger"
										: gpu.temperatureC && gpu.temperatureC >= 70
											? "warn"
											: "default"
								}
							/>
							<Stat
								label="Potencia"
								value={gpu.powerDrawW !== undefined ? `${gpu.powerDrawW.toFixed(1)} W` : "—"}
							/>
							<Stat
								label="Eficiencia energética"
								value={
									efficiencyTokPerWatt === "—" ? "En reposo" : `${efficiencyTokPerWatt} tok/s por W`
								}
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

			<div className="grid grid-2">
				<PageSection
					title="Recorrido tok/s"
					subtitle={`Último: ${current.toFixed(1)} tok/s · Pico sesión: ${peakTok.toFixed(1)} tok/s`}
				>
					<p className="stat">
						<span className="stat-label">Último valor</span>
						<span className="stat-value">{current.toFixed(1)} tok/s</span>
					</p>
					<div className="chart-wrap">
						{series.length > 1 ? (
							<Line
								data={throughputData}
								options={{
									responsive: true,
									maintainAspectRatio: false,
									scales: {
										x: { ticks: { maxTicksLimit: 8, color: "#8b93a7" } },
										y: { beginAtZero: true, ticks: { color: "#8b93a7" } },
									},
									plugins: {
										legend: { labels: { color: "#8b93a7" } },
									},
								}}
							/>
						) : (
							<p className="muted">acumulando muestras…</p>
						)}
					</div>
				</PageSection>

				<PageSection
					title="Carga y Temperatura GPU"
					subtitle="Evolución térmica (°C) y porcentaje de uso de núcleos CUDA"
				>
					<p className="stat">
						<span className="stat-label">Estado térmico</span>
						<span className="stat-value">
							{gpu?.temperatureC !== undefined ? `${gpu.temperatureC}°C` : "—"}
						</span>
					</p>
					<div className="chart-wrap">
						{series.length > 1 ? (
							<Line
								data={gpuChartData}
								options={{
									responsive: true,
									maintainAspectRatio: false,
									scales: {
										x: { ticks: { maxTicksLimit: 8, color: "#8b93a7" } },
										y: { min: 0, max: 100, ticks: { color: "#8b93a7" } },
									},
									plugins: {
										legend: { labels: { color: "#8b93a7" } },
									},
								}}
							/>
						) : (
							<p className="muted">acumulando muestras…</p>
						)}
					</div>
				</PageSection>
			</div>

			<PageSection
				title={`Slots de Inferencia (${slots.length})`}
				subtitle="Estado detallado de los slots concurrentes de llama-server (/slots)"
			>
				{slots.length > 0 ? (
					<div className="table-scroll">
						<table className="table">
							<thead>
								<tr>
									<th>Slot</th>
									<th>Modelo</th>
									<th className="num">Prompt Tokens</th>
									<th className="num">Tokens Generados</th>
									<th className="num">Prompt Speed</th>
									<th className="num">Gen Speed</th>
								</tr>
							</thead>
							<tbody>
								{slots.map((s) => (
									<tr key={s.id}>
										<td className="mono">#{s.id}</td>
										<td className="mono">{s.model || status?.loadedModel || "—"}</td>
										<td className="num">{s.promptN.toLocaleString()}</td>
										<td className="num">{s.predictedN.toLocaleString()}</td>
										<td className="num">{s.promptPerSec.toFixed(1)} tok/s</td>
										<td className="num">
											<span className="badge badge-on">{s.predictedPerSec.toFixed(1)} tok/s</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<p className="muted">Sin slots reportados por llama-server en este momento.</p>
				)}
			</PageSection>
		</div>
	);
}
