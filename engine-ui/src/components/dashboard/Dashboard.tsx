import { useRuntime } from "../../hooks/useRuntime";
import { statusLabel, statusTone } from "../layout/Topbar";
import { fmtUptime } from "../ui/helpers";
import { PageHeader } from "../ui/PageHeader";
import { ErrorState, Loading } from "../ui/states";

export function Dashboard() {
	const { status, health, error, loading, refresh } = useRuntime();

	if (loading) return <Loading />;
	if (error && !status) return <ErrorState error={error} onRetry={refresh} />;

	const tokPerSec = status?.slots.reduce((a, s) => a + (s.predictedPerSec || 0), 0) || 0;
	const tone = statusTone(status ?? null, health ?? null);

	return (
		<div className="page-stack">
			<PageHeader title="Dashboard" description="Métricas del motor en tiempo real" />

			<div className="metric-tiles">
				<div className="metric-tile">
					<span className="metric-label">Salud runtime</span>
					<span className="metric-value metric-value-text">
						<span className={`dot ${tone}`} aria-hidden="true" />
						{statusLabel(status ?? null, health ?? null)}
					</span>
				</div>
				<div className="metric-tile">
					<span className="metric-label">Modelo cargado</span>
					<span className="metric-value metric-value-text">{status?.loadedModel || "—"}</span>
				</div>
				<div className="metric-tile">
					<span className="metric-label">Throughput</span>
					<span className="metric-value">
						{tokPerSec.toFixed(1)}
						<small> tok/s</small>
					</span>
				</div>
				<div className="metric-tile">
					<span className="metric-label">Uptime API</span>
					<span className="metric-value metric-value-text">
						{status ? fmtUptime(status.apiUptimeMs) : "—"}
					</span>
				</div>
				<div className="metric-tile">
					<span className="metric-label">Modelos registrados</span>
					<span className="metric-value">{status ? String(status.models.length) : "—"}</span>
				</div>
			</div>
		</div>
	);
}
