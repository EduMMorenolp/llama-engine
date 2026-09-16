import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { getTrainJob } from "../../api";
import type { TrainJob } from "../../api";

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

		poll();
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

	const progressPct = currentJob.totalEpochs > 0 ? ((currentJob.epoch - 1) / currentJob.totalEpochs) * 100 : 0;
	const isRunning = currentJob.status === "running" || currentJob.status === "pending";

	return (
		<div className="training-progress">
			<h3>
				{currentJob.status === "completed" && "✅ Entrenamiento completado"}
				{currentJob.status === "failed" && "❌ Entrenamiento falló"}
				{currentJob.status === "running" && "Entrenando..."}
				{currentJob.status === "pending" && "Iniciando..."}
			</h3>

			<div className="progress-bar-container">
				<div
					className={`progress-bar ${currentJob.status === "failed" ? "error" : ""}`}
					style={{ width: `${progressPct}%` }}
				/>
			</div>

			<div className="progress-stats">
				<span>Epoch {currentJob.epoch}/{currentJob.totalEpochs}</span>
				{currentJob.loss > 0 && <span>Loss: {currentJob.loss.toFixed(4)}</span>}
				{currentJob.evalLoss !== undefined && <span>Eval: {currentJob.evalLoss.toFixed(4)}</span>}
				<span>{currentJob.progress}%</span>
			</div>

			<div className="training-logs">
				<h4>Logs</h4>
				<div className="logs-scroll">
					{currentJob.logs.map((line, i) => (
						<div key={i} className="log-line">{line}</div>
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
