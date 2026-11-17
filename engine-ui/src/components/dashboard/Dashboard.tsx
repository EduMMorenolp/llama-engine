import {
	CategoryScale,
	Chart as ChartJS,
	Filler,
	LinearScale,
	LineElement,
	PointElement,
	Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Link, useNavigate } from "react-router-dom";
import { useModels } from "../../hooks/useModels";
import { useRuntime } from "../../hooks/useRuntime";
import { statusLabel, statusTone } from "../layout/Topbar";
import { Button } from "../ui/Button";
import { Card, Stat, VramBar } from "../ui/Card";
import { fmtBytes, fmtTime, fmtUptime } from "../ui/helpers";
import {
	IconActivity,
	IconBolt,
	IconCpu,
	IconEye,
	IconGauge,
	IconModels,
	IconPlayground,
	IconSparkles,
} from "../ui/Icons";
import { PageHeader } from "../ui/PageHeader";
import { ErrorState, Loading } from "../ui/states";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

export function Dashboard() {
	const navigate = useNavigate();
	const { status, health, series, error, loading, refresh } = useRuntime();
	const actions = useModels(status?.models ?? [], refresh);

	if (loading) return <Loading />;
	if (error && !status) return <ErrorState error={error} onRetry={refresh} />;

	const tokPerSec = status?.slots.reduce((a, s) => a + (s.predictedPerSec || 0), 0) || 0;
	const promptPerSec = status?.slots.reduce((a, s) => a + (s.promptPerSec || 0), 0) || 0;
	const tone = statusTone(status ?? null, health ?? null);
	const gpu = status?.gpu;
	const registry = status?.models ?? [];
	const loadedObj = registry.find((m) => m.id === status?.loadedModel);

	const chartData = {
		labels: series.slice(-30).map((p) => fmtTime(p.t)),
		datasets: [
			{
				label: "Generación (tok/s)",
				data: series.slice(-30).map((p) => p.tok),
				borderColor: "#34d399",
				backgroundColor: "rgba(52, 211, 153, 0.14)",
				fill: true,
				tension: 0.35,
				pointRadius: 0,
				borderWidth: 2,
			},
		],
	};

	return (
		<div className="page-stack">
			<PageHeader
				title="Dashboard"
				description="Centro de control y telemetría en tiempo real de llama.cpp"
				badge={status?.loadedModel ? `Activo: ${status.loadedModel}` : undefined}
				actions={
					<div className="action-row">
						<Button variant="primary" onClick={() => navigate("/playground")}>
							<IconPlayground size={15} />
							<span>Playground Studio</span>
						</Button>
						<Button variant="default" onClick={() => navigate("/test")}>
							<IconGauge size={15} />
							<span>Test & Benchmark</span>
						</Button>
						<Button variant="ghost" onClick={() => navigate("/modelos/crear")}>
							<IconSparkles size={15} />
							<span>Asistente de Modelos</span>
						</Button>
					</div>
				}
			/>

			{/* Hero Engine Banner */}
			<section className="hero-banner">
				<div className="hero-banner-main">
					<div className="hero-status-line">
						<span className={`dot ${tone}`} aria-hidden="true" />
						<span className="hero-status-text">{statusLabel(status ?? null, health ?? null)}</span>
						<span className="badge badge-muted">CUDA 12.8 · sm_120</span>
						<span className="badge badge-muted">Flash Attention</span>
						{loadedObj?.vision ? (
							<span className="badge badge-on">
								<IconEye size={12} /> Visión Multimodal
							</span>
						) : null}
					</div>
					<h2 className="hero-model-title">
						{status?.loadedModel ? (
							<>
								Modelo en VRAM: <span className="mono accent-text">{status.loadedModel}</span>
							</>
						) : (
							"Ningún modelo cargado en el runtime"
						)}
					</h2>
					<p className="muted">
						{health?.ctxSize
							? `Ventana de contexto activa: ${health.ctxSize.toLocaleString()} tokens · ${status?.slots.length ?? 0} slot(s) de inferencia`
							: "Seleccioná un modelo GGUF desde el catálogo inferior o desde la pantalla Modelos."}
					</p>
				</div>
				<div className="hero-banner-stats">
					<div className="hero-mini-kpi">
						<span className="hero-mini-label">Generación</span>
						<span className="hero-mini-val">
							{tokPerSec.toFixed(1)} <small>tok/s</small>
						</span>
					</div>
					<div className="hero-mini-kpi">
						<span className="hero-mini-label">Prefill Prompt</span>
						<span className="hero-mini-val">
							{promptPerSec.toFixed(0)} <small>tok/s</small>
						</span>
					</div>
				</div>
			</section>

			{/* KPI Metric Tiles */}
			<div className="metric-tiles">
				<div className="metric-tile">
					<div className="metric-tile-top">
						<span className="metric-label">Salud Runtime</span>
						<IconCpu size={16} className="muted" />
					</div>
					<span className="metric-value metric-value-text">
						<span className={`dot ${tone}`} aria-hidden="true" />
						{statusLabel(status ?? null, health ?? null)}
					</span>
					<span className="metric-sub">
						Uptime API: {status ? fmtUptime(status.apiUptimeMs) : "—"}
					</span>
				</div>

				<div className="metric-tile">
					<div className="metric-tile-top">
						<span className="metric-label">Modelo Cargado</span>
						<IconModels size={16} className="muted" />
					</div>
					<span className="metric-value metric-value-text mono">{status?.loadedModel || "—"}</span>
					<span className="metric-sub">
						{loadedObj ? `${fmtBytes(loadedObj.sizeBytes)} en disco` : "Sin modelo activo"}
					</span>
				</div>

				<div className="metric-tile">
					<div className="metric-tile-top">
						<span className="metric-label">Throughput</span>
						<IconBolt size={16} className="accent-text" />
					</div>
					<span className="metric-value">
						{tokPerSec.toFixed(1)}
						<small> tok/s</small>
					</span>
					<span className="metric-sub">Prompt: {promptPerSec.toFixed(1)} tok/s</span>
				</div>

				<div className="metric-tile">
					<div className="metric-tile-top">
						<span className="metric-label">Sensores GPU</span>
						<IconActivity size={16} className="muted" />
					</div>
					<span className="metric-value">
						{gpu?.available && gpu.gpuUtilPct !== undefined ? `${gpu.gpuUtilPct}%` : "—"}
						<small>{gpu?.temperatureC !== undefined ? ` · ${gpu.temperatureC}°C` : ""}</small>
					</span>
					<span className="metric-sub">
						{gpu?.powerDrawW !== undefined
							? `Consumo: ${gpu.powerDrawW.toFixed(1)} W`
							: "Sin lectura de energía"}
					</span>
				</div>

				<div className="metric-tile">
					<div className="metric-tile-top">
						<span className="metric-label">Modelos Registrados</span>
						<IconModels size={16} className="muted" />
					</div>
					<span className="metric-value">{status ? String(status.models.length) : "—"}</span>
					<span className="metric-sub">
						{registry.filter((m) => m.vision).length} con visión (mmproj)
					</span>
				</div>
			</div>

			{/* Middle Grid: Live Sparkline + GPU VRAM Card */}
			<div className="grid grid-2">
				<Card
					title="Actividad de Inferencia (tok/s)"
					action={
						<Link to="/telemetria" className="card-link">
							Ver telemetría completa →
						</Link>
					}
				>
					<div className="chart-wrap chart-wrap-sm">
						{series.length > 1 ? (
							<Line
								data={chartData}
								options={{
									responsive: true,
									maintainAspectRatio: false,
									scales: {
										x: { ticks: { maxTicksLimit: 6, color: "#8b93a7" } },
										y: { beginAtZero: true, ticks: { color: "#8b93a7" } },
									},
									plugins: { legend: { display: false } },
								}}
							/>
						) : (
							<div className="chart-placeholder muted">
								Acumulando muestras de telemetría cada 3s…
							</div>
						)}
					</div>
				</Card>

				<Card
					title="Estado de GPU & VRAM"
					action={
						<Link to="/runtime" className="card-link">
							Ver Runtime →
						</Link>
					}
				>
					{gpu?.available ? (
						<>
							<Stat label="Acelerador" value={gpu.name || "NVIDIA GPU"} />
							<Stat
								label="Temperatura / Potencia"
								value={`${gpu.temperatureC ?? "—"}°C · ${gpu.powerDrawW !== undefined ? `${gpu.powerDrawW.toFixed(1)} W` : "—"}`}
								tone={
									gpu.temperatureC && gpu.temperatureC >= 80
										? "danger"
										: gpu.temperatureC && gpu.temperatureC >= 70
											? "warn"
											: "default"
								}
							/>
							{gpu.vramTotalMiB ? (
								<VramBar used={gpu.vramUsedMiB || 0} total={gpu.vramTotalMiB} />
							) : null}
						</>
					) : (
						<p className="muted">GPU no disponible (sin salida de nvidia-smi en el contenedor).</p>
					)}
				</Card>
			</div>

			{/* Quick Model Catalog */}
			<Card
				title={`Catálogo Rápido de Modelos (${registry.length})`}
				action={
					<Link to="/modelos" className="card-link">
						Gestionar modelos y Hugging Face →
					</Link>
				}
			>
				{registry.length === 0 ? (
					<p className="muted">
						No hay archivos .gguf en /models. Descargá uno desde la sección Modelos.
					</p>
				) : (
					<div className="quick-models-grid">
						{registry.map((m) => {
							const isLoaded = m.id === status?.loadedModel;
							return (
								<div
									key={m.id}
									className={`quick-model-card ${isLoaded ? "quick-model-active" : ""}`}
								>
									<div className="quick-model-head">
										<span className="quick-model-name mono">{m.id}</span>
										<span className={`badge ${isLoaded ? "badge-on" : "badge-muted"}`}>
											{isLoaded ? "cargado" : "disponible"}
										</span>
									</div>
									<div className="quick-model-meta muted">
										<span>{fmtBytes(m.sizeBytes)}</span>
										<span>·</span>
										<span>{m.vision ? "Visión + Texto" : "Solo Texto"}</span>
									</div>
									<div className="quick-model-actions">
										{isLoaded ? (
											<div className="action-row">
												<Button
													size="sm"
													variant="primary"
													onClick={() => navigate(`/playground?model=${encodeURIComponent(m.id)}`)}
												>
													<IconPlayground size={14} />
													<span>Chatear</span>
												</Button>
												<Button size="sm" variant="ghost" onClick={() => navigate("/test")}>
													<IconGauge size={14} />
													<span>Testear</span>
												</Button>
											</div>
										) : (
											<Button
												size="sm"
												busy={actions.busyAction === "reload"}
												onClick={() => actions.reload(m.id)}
											>
												Cargar en GPU
											</Button>
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</Card>
		</div>
	);
}
