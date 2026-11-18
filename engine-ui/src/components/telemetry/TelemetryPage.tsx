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
import { useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import { useNavigate } from "react-router-dom";
import { type TelemetryPoint, useRuntime } from "../../hooks/useRuntime";
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
const PURPLE = "#a78bfa";
const CYAN = "#22d3ee";

type TimeRange = "2m" | "5m" | "15m" | "30m" | "all";

function filterSeries(data: TelemetryPoint[], range: TimeRange): TelemetryPoint[] {
	if (data.length === 0) return [];
	if (range === "2m") return data.slice(-40);
	if (range === "5m") return data.slice(-100);
	if (range === "15m") return data.slice(-300);
	if (range === "30m") return data.slice(-600);
	return data;
}

export function TelemetryPage() {
	const navigate = useNavigate();
	const { status, health, series, error, loading, refresh } = useRuntime();

	// Selectores de tiempo independientes por cada gráfico
	const [tokRange, setTokRange] = useState<TimeRange>("5m");
	const [gpuRange, setGpuRange] = useState<TimeRange>("5m");
	const [hostRange, setHostRange] = useState<TimeRange>("5m");

	const tokSeries = useMemo(() => filterSeries(series, tokRange), [series, tokRange]);
	const gpuSeries = useMemo(() => filterSeries(series, gpuRange), [series, gpuRange]);
	const hostSeries = useMemo(() => filterSeries(series, hostRange), [series, hostRange]);

	if (loading) return <Loading />;
	if (error && !status) return <ErrorState error={error} onRetry={refresh} />;

	const handleExportCsv = () => {
		if (series.length === 0) return;
		const header =
			"timestamp,time,gen_tok_s,prompt_tok_s,gpu_util_pct,vram_used_mib,temp_c,power_w,cpu_util_pct,ram_used_mib";
		const rows = series.map(
			(p) =>
				`${p.t},${fmtTime(p.t)},${p.tok.toFixed(2)},${p.promptTok.toFixed(2)},${p.gpuUtil},${p.vramUsedMiB},${p.tempC},${p.powerW.toFixed(1)},${p.cpuUtil ?? 0},${p.ramUsedMiB ?? 0}`,
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
	const sys = status?.system;
	const slots = status?.slots ?? [];

	const latestPointTok = series.length ? series[series.length - 1].tok : 0;
	const lastActiveTok = [...series].reverse().find((p) => p.tok > 0)?.tok ?? 0;
	const current = latestPointTok > 0 ? latestPointTok : lastActiveTok;
	const peakTok = series.reduce((max, p) => Math.max(max, p.tok), 0);
	const efficiencyTokPerWatt =
		gpu?.powerDrawW && gpu.powerDrawW > 0 && current > 0
			? (current / gpu.powerDrawW).toFixed(2)
			: "—";

	const throughputData = {
		labels: tokSeries.map((p) => fmtTime(p.t)),
		datasets: [
			{
				label: "Generación (tok/s)",
				data: tokSeries.map((p) => p.tok),
				borderColor: ACCENT,
				backgroundColor: ACCENT_FILL,
				fill: true,
				tension: 0.3,
				pointRadius: tokSeries.length > 80 ? 0 : 2,
			},
			{
				label: "Prompt Prefill (tok/s)",
				data: tokSeries.map((p) => p.promptTok),
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
		labels: gpuSeries.map((p) => fmtTime(p.t)),
		datasets: [
			{
				label: "GPU Util (%)",
				data: gpuSeries.map((p) => p.gpuUtil),
				borderColor: INFO,
				backgroundColor: "rgba(96, 165, 250, 0.12)",
				fill: true,
				tension: 0.3,
				pointRadius: gpuSeries.length > 80 ? 0 : 2,
			},
			{
				label: "Temp (°C)",
				data: gpuSeries.map((p) => p.tempC),
				borderColor: WARN,
				backgroundColor: "transparent",
				fill: false,
				tension: 0.3,
				pointRadius: 0,
			},
		],
	};

	const hostChartData = {
		labels: hostSeries.map((p) => fmtTime(p.t)),
		datasets: [
			{
				label: "CPU Host (%)",
				data: hostSeries.map((p) => p.cpuUtil ?? 0),
				borderColor: PURPLE,
				backgroundColor: "rgba(167, 139, 250, 0.12)",
				fill: true,
				tension: 0.3,
				pointRadius: hostSeries.length > 80 ? 0 : 2,
			},
			{
				label: "RAM Sistema (%)",
				data: hostSeries.map((p) =>
					p.ramTotalMiB && p.ramTotalMiB > 0
						? Math.round(((p.ramUsedMiB ?? 0) / p.ramTotalMiB) * 100)
						: 0,
				),
				borderColor: CYAN,
				backgroundColor: "transparent",
				fill: false,
				tension: 0.3,
				pointRadius: 0,
				borderDash: [3, 3],
			},
		],
	};

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		interaction: {
			mode: "index" as const,
			intersect: false,
		},
		scales: {
			x: { ticks: { maxTicksLimit: 6, color: "#8b93a7" } },
			y: { beginAtZero: true, ticks: { color: "#8b93a7" } },
		},
		plugins: {
			legend: { labels: { color: "#8b93a7" } },
		},
	};

	const percentChartOptions = {
		...chartOptions,
		scales: {
			x: { ticks: { maxTicksLimit: 6, color: "#8b93a7" } },
			y: { min: 0, max: 100, ticks: { color: "#8b93a7" } },
		},
	};

	const renderTimeDropdown = (
		currentVal: TimeRange,
		onChange: (val: TimeRange) => void,
		count: number,
	) => (
		<select
			className="chart-range-select"
			value={currentVal}
			onChange={(e) => onChange(e.target.value as TimeRange)}
			aria-label="Rango de tiempo del gráfico"
		>
			<option value="2m">2 min</option>
			<option value="5m">5 min</option>
			<option value="15m">15 min</option>
			<option value="30m">30 min</option>
			<option value="all">Todo ({count})</option>
		</select>
	);

	return (
		<div className="page-stack">
			<PageHeader
				title="Telemetría"
				description="Sistema, sensores GPU NVIDIA, host PC, slots concurrentes y curvas de throughput de la sesión"
				badge={`${series.length} muestras (${fmtUptime(series.length * 3 * 1000)})`}
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

			{/* Fila 1: Sistema, GPU NVIDIA y Host PC */}
			<div className="grid grid-3">
				<Card title="Sistema">
					<Stat label="Versión" value={`v${APP_VERSION}`} />
					<Stat label="Uptime API" value={status ? fmtUptime(status.apiUptimeMs) : "—"} />
					<Stat label="Modelo cargado" value={status?.loadedModel || "—"} />
					<Stat
						label="Ventana de contexto"
						value={health?.ctxSize ? `${health.ctxSize.toLocaleString()} tokens` : "—"}
					/>
					<Stat label="Modelos registrados" value={status ? String(status.models.length) : "—"} />
					<p className="specs-note">
						Motor llama.cpp · backend CUDA (Blackwell) · API OpenAI-compatible
					</p>
				</Card>

				<Card title="GPU NVIDIA">
					{gpu?.available ? (
						<>
							<Stat label="GPU" value={gpu.name?.replace(/^[^\x20-\x7E]+/, "").trim() || "—"} />
							<Stat
								label="Uso núcleos"
								value={gpu.gpuUtilPct !== undefined ? `${gpu.gpuUtilPct}%` : "—"}
							/>
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
								label="Eficiencia"
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

				<Card title="Host / PC">
					{sys ? (
						<>
							<Stat
								label="Equipo / SO"
								value={`${sys.hostname || "PC"} (${sys.platform || "linux"})`}
							/>
							<Stat label="Procesador CPU" value={`${sys.cpuModel} (${sys.cpuCores} núcleos)`} />
							<Stat label="Carga de CPU" value={`${sys.cpuUsagePct}%`} />
							<div className="vram-bar-wrap">
								<div className="vram-bar-header">
									<span className="vram-bar-label">Memoria RAM del Sistema</span>
									<span className="vram-bar-values">
										{(sys.ramUsedMiB / 1024).toFixed(1)} / {(sys.ramTotalMiB / 1024).toFixed(1)} GB
										({sys.ramUsagePct}%)
									</span>
								</div>
								<div className="vram-bar-track">
									<div
										className="vram-bar-fill"
										style={{
											width: `${Math.min(100, Math.max(0, sys.ramUsagePct))}%`,
											backgroundColor:
												sys.ramUsagePct > 85
													? "#ef4444"
													: sys.ramUsagePct > 70
														? "#fbbf24"
														: "#a78bfa",
										}}
									/>
								</div>
							</div>
							<Stat label="Uptime Host" value={fmtUptime(sys.uptimeSeconds * 1000)} />
						</>
					) : (
						<p className="muted">Información de host recopilándose...</p>
					)}
				</Card>
			</div>

			{/* Fila 2: Gráficos con dropdown de tiempo INDEPENDIENTE en cada uno */}
			<div className="grid grid-3">
				<PageSection
					title="Recorrido tok/s"
					subtitle={`Último: ${current.toFixed(1)} tok/s · Pico: ${peakTok.toFixed(1)} tok/s`}
					actions={renderTimeDropdown(tokRange, setTokRange, series.length)}
				>
					<div className="chart-wrap">
						{tokSeries.length > 1 ? (
							<Line data={throughputData} options={chartOptions} />
						) : (
							<p className="muted">acumulando muestras…</p>
						)}
					</div>
				</PageSection>

				<PageSection
					title="Carga & Temp GPU"
					subtitle="Uso de núcleos CUDA (%) y temperatura térmica (°C)"
					actions={renderTimeDropdown(gpuRange, setGpuRange, series.length)}
				>
					<div className="chart-wrap">
						{gpuSeries.length > 1 ? (
							<Line data={gpuChartData} options={percentChartOptions} />
						) : (
							<p className="muted">acumulando muestras…</p>
						)}
					</div>
				</PageSection>

				<PageSection
					title="Host PC (CPU & RAM)"
					subtitle="Carga de CPU (%) y porcentaje de memoria RAM utilizada"
					actions={renderTimeDropdown(hostRange, setHostRange, series.length)}
				>
					<div className="chart-wrap">
						{hostSeries.length > 1 ? (
							<Line data={hostChartData} options={percentChartOptions} />
						) : (
							<p className="muted">acumulando muestras…</p>
						)}
					</div>
				</PageSection>
			</div>

			{/* Fila 3: Slots de Inferencia */}
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
