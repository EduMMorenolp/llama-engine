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
import type { TrainJob } from "../../api";
import { getTrainJob } from "../../api";
import { Button } from "../ui/Button";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

export function TrainingProgressStep({
	jobId,
	job,
	onComplete,
	onStop,
}: {
	jobId: string | null;
	job?: TrainJob;
	onComplete: () => void;
	onStop: () => void;
}) {
	const [localJob, setLocalJob] = useState<TrainJob | null>(null);

	const currentJob = job ?? localJob;

	useEffect(() => {
		if (!jobId || job) return;

		const poll = async () => {
			try {
				const data = await getTrainJob(jobId);
				setLocalJob(data);
				if (data.status === "completed") onComplete();
			} catch {
				// poll error
			}
		};

		void poll();
		const interval = setInterval(poll, 3000);
		return () => clearInterval(interval);
	}, [jobId, job, onComplete]);

	if (!jobId && !currentJob) {
		return (
			<div className="training-progress">
				<h3>Sin job de entrenamiento</h3>
				<p className="muted">No se inició ningún entrenamiento.</p>
			</div>
		);
	}

	if (!currentJob) {
		return (
			<div className="training-progress">
				<h3>Entrenando...</h3>
				<div className="progress-bar-container">
					<div className="progress-bar" style={{ width: "0%" }} />
				</div>
				<p className="muted">Iniciando job de entrenamiento...</p>
			</div>
		);
	}

	const progressPct =
		currentJob.progress > 0
			? currentJob.progress
			: currentJob.totalEpochs > 0
				? ((currentJob.epoch - 1) / currentJob.totalEpochs) * 100
				: 0;
	const isRunning = currentJob.status === "running" || currentJob.status === "pending";
	const history = currentJob.lossHistory ?? [];

	const lossChartData = {
		labels: history.map((p) => ` step ${p.step}`),
		datasets: [
			{
				label: "Training Loss",
				data: history.map((p) => p.loss),
				borderColor: "#34d399",
				backgroundColor: "rgba(52, 211, 153, 0.14)",
				fill: true,
				tension: 0.3,
				pointRadius: 2,
			},
		],
	};

	return (
		<div className="training-progress">
			<h3>
				{currentJob.status === "completed" && "✅ Entrenamiento completado"}
				{currentJob.status === "failed" && "❌ Entrenamiento falló"}
				{currentJob.status === "stopped" && "⏹ Entrenamiento detenido"}
				{currentJob.status === "running" && "🔥 Entrenando en GPU..."}
				{currentJob.status === "pending" && "⏳ Iniciando job..."}
			</h3>

			<div className="progress-bar-container">
				<div
					className={`progress-bar ${currentJob.status === "failed" ? "error" : ""}`}
					style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
				/>
			</div>

			<div className="progress-stats">
				<span>
					Epoch {currentJob.epoch}/{currentJob.totalEpochs}
				</span>
				{currentJob.loss > 0 && <span>Loss: {currentJob.loss.toFixed(4)}</span>}
				{currentJob.evalLoss !== undefined && <span>Eval: {currentJob.evalLoss.toFixed(4)}</span>}
				<span>{currentJob.progress}%</span>
			</div>

			{history.length > 1 ? (
				<div className="chart-wrap chart-wrap-sm" style={{ marginBottom: "1rem" }}>
					<Line
						data={lossChartData}
						options={{
							responsive: true,
							maintainAspectRatio: false,
							scales: {
								x: { ticks: { color: "#8b93a7", maxTicksLimit: 6 } },
								y: { ticks: { color: "#8b93a7" } },
							},
							plugins: { legend: { display: false } },
						}}
					/>
				</div>
			) : null}

			<div className="training-logs">
				<h4>Logs</h4>
				<div className="logs-scroll">
					{currentJob.logs.map((line) => (
						<div key={line} className="log-line">
							{line}
						</div>
					))}
					{currentJob.logs.length === 0 && <p className="muted">Esperando logs...</p>}
				</div>
			</div>

			{isRunning && (
				<div className="action-row">
					<Button variant="danger" onClick={onStop}>
						Detener entrenamiento
					</Button>
				</div>
			)}
		</div>
	);
}
