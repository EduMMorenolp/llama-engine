import { useState } from "react";
import { Button } from "../ui/Button";
import { quantizeModel } from "../../api";
import type { QuantizeResult } from "../../api";

const METHODS = [
	{ id: "Q4_K_M", name: "Q4_K_M", bits: 4.58, size7b: "~4.3 GB", quality: "★★★★☆", recommended: true, description: "Mejor balance tamaño/calidad." },
	{ id: "Q5_K_M", name: "Q5_K_M", bits: 5.33, size7b: "~5.0 GB", quality: "★★★★★", description: "Casi sin pérdida perceptible." },
	{ id: "Q6_K", name: "Q6_K", bits: 6.14, size7b: "~5.8 GB", quality: "★★★★★", description: "Prácticamente sin pérdida." },
	{ id: "Q8_0", name: "Q8_0", bits: 8.50, size7b: "~8.0 GB", quality: "★★★★★", description: "Máxima calidad." },
	{ id: "Q3_K_M", name: "Q3_K_M", bits: 3.74, size7b: "~3.5 GB", quality: "★★★☆☆", description: "Compresión agresiva." },
];

export function QuantizeStep({
	modelId,
	modelSize,
	onComplete,
}: {
	modelId: string;
	modelSize: number;
	onComplete: (result: QuantizeResult) => void;
}) {
	const [selectedMethod, setSelectedMethod] = useState("Q4_K_M");
	const [useImatrix, setUseImatrix] = useState(false);
	const [quantizing, setQuantizing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleQuantize = async () => {
		setQuantizing(true);
		setError(null);
		try {
			const result = await quantizeModel(modelId, selectedMethod, useImatrix);
			onComplete(result);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error desconocido");
		} finally {
			setQuantizing(false);
		}
	};

	return (
		<div className="quantize-step">
			<h3>Quantizá el modelo</h3>
			<p className="muted">Seleccioná el método de compresión para reducir el tamaño</p>

			<div className="quantize-grid">
				{METHODS.map((m) => (
					<button
						key={m.id}
						type="button"
						className={`quantize-card ${selectedMethod === m.id ? "selected" : ""}`}
						onClick={() => setSelectedMethod(m.id)}
					>
						<div className="quantize-header">
							<strong>{m.name}</strong>
							{m.recommended && <span className="method-badge">recomendado</span>}
						</div>
						<div className="quantize-meta">
							<span>{m.bits} bits/peso</span>
							<span>{m.size7b} (7B)</span>
						</div>
						<div className="quantize-quality">{m.quality}</div>
						<p className="quantize-desc">{m.description}</p>
					</button>
				))}
			</div>

			<div className="quantize-options">
				<label className="checkbox-label">
					<input
						type="checkbox"
						checked={useImatrix}
						onChange={(e) => setUseImatrix(e.target.checked)}
					/>
					<span>Generar imatrix (mejora calidad, +5 min)</span>
				</label>
				<p className="field-hint">La imatrix usa datos de calibración para mejorar quants bajo Q5_K_M</p>
			</div>

			<div className="quantize-summary">
				<span>Tamaño original: <strong>{formatBytes(modelSize)}</strong></span>
				<span>Tamaño estimado: <strong>{estimateSize(modelSize, selectedMethod)}</strong></span>
				<span>Reducción: <strong>{estimateReduction(selectedMethod)}%</strong></span>
			</div>

			{error && <p className="feedback feedback-error">{error}</p>}

			<div className="action-row">
				<Button busy={quantizing} onClick={handleQuantize}>
					{quantizing ? "Quantizando..." : "Iniciar quantización"}
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

function estimateSize(inputBytes: number, method: string): string {
	const ratios: Record<string, number> = {
		Q3_K_M: 0.35, Q4_K_M: 0.45, Q5_K_M: 0.52, Q6_K: 0.60, Q8_0: 0.85,
	};
	return formatBytes(inputBytes * (ratios[method] ?? 0.45));
}

function estimateReduction(method: string): number {
	const ratios: Record<string, number> = {
		Q3_K_M: 0.35, Q4_K_M: 0.45, Q5_K_M: 0.52, Q6_K: 0.60, Q8_0: 0.85,
	};
	return Math.round((1 - (ratios[method] ?? 0.45)) * 100);
}
