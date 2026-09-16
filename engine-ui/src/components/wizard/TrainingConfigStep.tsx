import { useState } from "react";

export interface TrainingConfig {
	method: "qlora" | "lora" | "full";
	epochs: number;
	learningRate: number;
	rank: number;
	batchSize: number;
	maxSeqLen: number;
	systemPrompt: string;
}

const METHODS = [
	{
		id: "qlora" as const,
		label: "QLoRA",
		recommended: true,
		description: "Entrena con 4-bit quantizado. Mínimo VRAM, alta velocidad.",
		vram: "~8 GB",
	},
	{
		id: "lora" as const,
		label: "LoRA",
		recommended: false,
		description: "Entrena con precisión completa. Mejor calidad, más VRAM.",
		vram: "~16 GB",
	},
	{
		id: "full" as const,
		label: "Full FT",
		recommended: false,
		description: "Fine-tuning completo. Máxima calidad, requiere mucha VRAM.",
		vram: "~60 GB+",
	},
];

export function TrainingConfigStep({
	value,
	onChange,
}: {
	value: TrainingConfig;
	onChange: (cfg: TrainingConfig) => void;
}) {
	const [config, setConfig] = useState<TrainingConfig>(value);

	const update = (patch: Partial<TrainingConfig>) => {
		const next = { ...config, ...patch };
		setConfig(next);
		onChange(next);
	};

	return (
		<div className="training-config-step">
			<h3>Configurá el entrenamiento</h3>

			<div className="method-selector">
				<h4>Método</h4>
				<div className="method-cards">
					{METHODS.map((m) => (
						<button
							key={m.id}
							type="button"
							className={`method-card ${config.method === m.id ? "selected" : ""}`}
							onClick={() => update({ method: m.id })}
						>
							<div className="method-header">
								<strong>{m.label}</strong>
								{m.recommended && <span className="method-badge">recomendado</span>}
							</div>
							<p className="method-desc">{m.description}</p>
							<span className="method-vram">VRAM: {m.vram}</span>
						</button>
					))}
				</div>
			</div>

			<div className="config-grid">
				<div className="field">
					<label htmlFor="cfg-epochs">Epochs</label>
					<input
						id="cfg-epochs"
						type="number"
						min={1}
						max={10}
						value={config.epochs}
						onChange={(e) => update({ epochs: Number(e.target.value) || 1 })}
					/>
					<span className="field-hint">Número de vueltas al dataset (1-10)</span>
				</div>

				<div className="field">
					<label htmlFor="cfg-lr">Learning Rate</label>
					<input
						id="cfg-lr"
						type="text"
						value={config.learningRate}
						onChange={(e) => update({ learningRate: Number(e.target.value) || 2e-4 })}
					/>
					<span className="field-hint">Velocidad de aprendizaje (1e-5 - 5e-4)</span>
				</div>

				{config.method !== "full" && (
					<div className="field">
						<label htmlFor="cfg-rank">Rank (LoRA)</label>
						<input
							id="cfg-rank"
							type="number"
							min={8}
							max={256}
							step={8}
							value={config.rank}
							onChange={(e) => update({ rank: Number(e.target.value) || 64 })}
						/>
						<span className="field-hint">Mayor rank = más capacidad, más VRAM</span>
					</div>
				)}

				<div className="field">
					<label htmlFor="cfg-batch">Batch Size</label>
					<input
						id="cfg-batch"
						type="number"
						min={1}
						max={32}
						value={config.batchSize}
						onChange={(e) => update({ batchSize: Number(e.target.value) || 1 })}
					/>
					<span className="field-hint">Ejemplos por paso (1-32)</span>
				</div>

				<div className="field">
					<label htmlFor="cfg-seqlen">Max Sequence Length</label>
					<input
						id="cfg-seqlen"
						type="number"
						min={512}
						max={8192}
						step={512}
						value={config.maxSeqLen}
						onChange={(e) => update({ maxSeqLen: Number(e.target.value) || 2048 })}
					/>
					<span className="field-hint">Longitud máxima de tokens</span>
				</div>
			</div>

			<div className="field">
				<label htmlFor="cfg-sysprompt">System Prompt (opcional)</label>
				<textarea
					id="cfg-sysprompt"
					rows={2}
					placeholder="Sos un asistente experto en..."
					value={config.systemPrompt}
					onChange={(e) => update({ systemPrompt: e.target.value })}
				/>
				<span className="field-hint">Se agrega al inicio de cada ejemplo de entrenamiento</span>
			</div>

			<div className="config-summary">
				<h4>Estimación</h4>
				<div className="config-stats">
					<span>Método: <strong>{config.method.toUpperCase()}</strong></span>
					<span>VRAM estimada: <strong>{config.method === "full" ? "60+ GB" : config.method === "lora" ? "~16 GB" : "~8 GB"}</strong></span>
					<span>Epochs: <strong>{config.epochs}</strong></span>
				</div>
			</div>
		</div>
	);
}
