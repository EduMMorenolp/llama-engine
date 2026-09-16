import { useState } from "react";
import { Button } from "../ui/Button";

interface DeployInfo {
	name: string;
	baseModel: string;
	dataset: string;
	method: string;
	quantMethod: string;
	sizeBytes: number;
	path: string;
}

export function DeployStep({
	info,
	onDeploy,
}: {
	info: DeployInfo;
	onDeploy: (activate: boolean) => void;
}) {
	const [activate, setActivate] = useState(true);
	const [deploying, setDeploying] = useState(false);

	const handleDeploy = async () => {
		setDeploying(true);
		try {
			onDeploy(activate);
		} finally {
			setDeploying(false);
		}
	};

	return (
		<div className="deploy-step">
			<h3>✅ Modelo listo para usar</h3>

			<div className="deploy-summary">
				<h4>Resumen</h4>
				<div className="deploy-stats">
					<div className="deploy-stat">
						<span className="deploy-stat-label">Nombre</span>
						<span className="deploy-stat-value mono">{info.name}</span>
					</div>
					<div className="deploy-stat">
						<span className="deploy-stat-label">Base</span>
						<span className="deploy-stat-value">{info.baseModel}</span>
					</div>
					<div className="deploy-stat">
						<span className="deploy-stat-label">Dataset</span>
						<span className="deploy-stat-value">{info.dataset}</span>
					</div>
					<div className="deploy-stat">
						<span className="deploy-stat-label">Método</span>
						<span className="deploy-stat-value">{info.method}</span>
					</div>
					<div className="deploy-stat">
						<span className="deploy-stat-label">Quant</span>
						<span className="deploy-stat-value">{info.quantMethod}</span>
					</div>
					<div className="deploy-stat">
						<span className="deploy-stat-label">Tamaño</span>
						<span className="deploy-stat-value">{formatBytes(info.sizeBytes)}</span>
					</div>
				</div>
			</div>

			<label className="checkbox-label">
				<input
					type="checkbox"
					checked={activate}
					onChange={(e) => setActivate(e.target.checked)}
				/>
				<span>Activar como modelo principal</span>
			</label>

			<div className="action-row">
				<Button busy={deploying} onClick={handleDeploy}>
					{deploying ? "Deployando..." : "Deploy a /models →"}
				</Button>
			</div>
		</div>
	);
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}
