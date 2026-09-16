import { useCallback, useEffect, useState } from "react";
import { fetchRuntimeLogs } from "../../api";
import { useModels } from "../../hooks/useModels";
import { useRuntime } from "../../hooks/useRuntime";
import { Button } from "../ui/Button";
import { PageHeader, PageSection } from "../ui/PageHeader";
import { ErrorState, Loading } from "../ui/states";

const TAIL_OPTIONS = [50, 100, 200];

export function RuntimePage() {
	const { status, config, error, loading, refresh } = useRuntime();
	const master = useModels([], refresh);

	const [tail, setTail] = useState(100);
	const [logs, setLogs] = useState<string[]>([]);
	const [logsLoading, setLogsLoading] = useState(true);
	const [logsError, setLogsError] = useState<string | null>(null);

	const loadLogs = useCallback(async () => {
		try {
			const res = await fetchRuntimeLogs(tail);
			setLogs(res.lines);
			setLogsError(null);
		} catch (err) {
			setLogsError(err instanceof Error ? err.message : String(err));
		} finally {
			setLogsLoading(false);
		}
	}, [tail]);

	useEffect(() => {
		loadLogs();
	}, [loadLogs]);

	if (loading) return <Loading />;
	if (error && !status) return <ErrorState error={error} onRetry={refresh} />;

	const engine = config?.engine;
	const envEntries = config?.runtimeEnv ? Object.entries(config.runtimeEnv) : [];

	return (
		<div className="page-stack">
			<PageHeader
				title="Runtime"
				description="Configuración efectiva del motor y su ciclo de vida"
			/>

			<div className="grid grid-2">
				<PageSection title="Engine">
					{engine ? (
						<dl className="kv">
							{Object.entries(engine).map(([key, value]) => (
								<div key={key} className="kv-row">
									<dt>{key}</dt>
									<dd>{String(value)}</dd>
								</div>
							))}
						</dl>
					) : (
						<p className="muted">config no disponible</p>
					)}
				</PageSection>

				<PageSection title="runtimeEnv">
					{envEntries.length > 0 ? (
						<table className="table env-table">
							<tbody>
								{envEntries.map(([key, value]) => (
									<tr key={key}>
										<th scope="row">{key}</th>
										<td className="td-code">{value}</td>
									</tr>
								))}
							</tbody>
						</table>
					) : (
						<p className="muted">sin variables</p>
					)}
				</PageSection>
			</div>

			<PageSection title="Controles">
				<div className="action-row">
					<Button variant="danger" busy={master.busyAction === "restart"} onClick={master.restart}>
						Reiniciar
					</Button>
					<Button variant="danger" busy={master.busyAction === "stop"} onClick={master.stop}>
						Stop
					</Button>
					<Button busy={master.busyAction === "start"} onClick={master.start}>
						Start
					</Button>
				</div>
				{master.error ? (
					<p className="feedback feedback-error" role="status">
						{master.error}
					</p>
				) : null}
				{master.message ? (
					<p className="feedback feedback-ok" role="status">
						{master.message}
					</p>
				) : null}
			</PageSection>

			<PageSection title="Logs">
				<div className="log-controls">
					<div className="field field-narrow">
						<label htmlFor="log-tail">Líneas</label>
						<select id="log-tail" value={tail} onChange={(e) => setTail(Number(e.target.value))}>
							{TAIL_OPTIONS.map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</select>
					</div>
					<Button variant="ghost" onClick={loadLogs} busy={logsLoading}>
						Actualizar
					</Button>
				</div>
				{logsError ? (
					<p className="feedback feedback-error" role="status">
						{logsError}
					</p>
				) : null}
				<div className="logs" role="log" aria-live="off" aria-busy={logsLoading || undefined}>
					{logsLoading ? (
						<p className="muted">cargando logs…</p>
					) : logs.length === 0 ? (
						<p className="muted">sin líneas de log</p>
					) : (
						<pre>{logs.join("\n")}</pre>
					)}
				</div>
			</PageSection>
		</div>
	);
}
