import { useState } from "react";
import { createPortal } from "react-dom";
import {
	BrainIcon,
	CheckIcon,
	RotateCcwIcon,
	SlidersIcon,
	XIcon,
} from "../../../components/ui/Icons.tsx";

export interface ModelSettings {
	enableReasoning: boolean;
	temperature: number;
	topP: number;
	maxTokens: number;
	presencePenalty: number;
	frequencyPenalty: number;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
	enableReasoning: true,
	temperature: 0.7,
	topP: 0.9,
	maxTokens: 4096,
	presencePenalty: 0.0,
	frequencyPenalty: 0.0,
};

interface ModelSettingsModalProps {
	settings: ModelSettings;
	modelName?: string;
	onSave: (settings: ModelSettings) => void;
	onClose: () => void;
}

const PRESETS: Array<{
	name: string;
	icon: string;
	desc: string;
	settings: Partial<ModelSettings>;
}> = [
	{
		name: "Preciso / Código",
		icon: "🎯",
		desc: "Determinista y estructurado",
		settings: { temperature: 0.2, topP: 0.8, enableReasoning: true },
	},
	{
		name: "Balanceado",
		icon: "⚖️",
		desc: "Uso general equilibrado",
		settings: { temperature: 0.7, topP: 0.9, enableReasoning: true },
	},
	{
		name: "Creativo",
		icon: "🎨",
		desc: "Variado y expresivo",
		settings: { temperature: 1.1, topP: 0.95, enableReasoning: true },
	},
	{
		name: "Directo / Rápido",
		icon: "⚡",
		desc: "Sin bloque de razonamiento",
		settings: { temperature: 0.5, topP: 0.9, enableReasoning: false },
	},
];

export function ModelSettingsModal({
	settings: initialSettings,
	modelName,
	onSave,
	onClose,
}: ModelSettingsModalProps) {
	const [settings, setSettings] = useState<ModelSettings>({
		...DEFAULT_MODEL_SETTINGS,
		...initialSettings,
	});

	const handleApplyPreset = (presetSettings: Partial<ModelSettings>) => {
		setSettings((prev) => ({
			...prev,
			...presetSettings,
		}));
	};

	const handleReset = () => {
		setSettings(DEFAULT_MODEL_SETTINGS);
	};

	const handleSave = () => {
		onSave(settings);
		onClose();
	};

	return createPortal(
		<div className="modal-overlay" onClick={onClose}>
			<div
				className="modal-card"
				style={{ maxWidth: "560px", width: "100%" }}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Modal Header */}
				<div className="modal-header">
					<div className="modal-title-row">
						<div className="modal-icon-badge">
							<SlidersIcon size={18} style={{ color: "var(--accent)" }} />
						</div>
						<div>
							<h3 className="modal-title">Configuración del Modelo</h3>
							<p className="modal-subtitle">
								Parámetros de muestreo y razonamiento para {modelName || "el modelo activo"}
							</p>
						</div>
					</div>
					<button
						type="button"
						className="action-icon-btn"
						onClick={onClose}
						title="Cerrar (Esc)"
					>
						<XIcon size={16} />
					</button>
				</div>

				{/* Modal Body */}
				<div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
					{/* Quick Presets */}
					<div>
						<label
							style={{
								fontSize: "12px",
								fontWeight: 600,
								color: "var(--text-secondary)",
								marginBottom: "8px",
								display: "block",
							}}
						>
							Presets Rápidos
						</label>
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(2, 1fr)",
								gap: "8px",
							}}
						>
							{PRESETS.map((p) => (
								<button
									key={p.name}
									type="button"
									className="preset-btn"
									onClick={() => handleApplyPreset(p.settings)}
									style={{
										display: "flex",
										alignItems: "center",
										gap: "8px",
										padding: "8px 10px",
										background: "var(--bg-surface-active)",
										border: "1px solid var(--border-subtle)",
										borderRadius: "var(--r-sm)",
										color: "var(--text-primary)",
										cursor: "pointer",
										textAlign: "left",
										transition: "all 0.15s ease",
									}}
								>
									<span style={{ fontSize: "16px" }}>{p.icon}</span>
									<div style={{ overflow: "hidden" }}>
										<div style={{ fontSize: "12px", fontWeight: 600 }}>{p.name}</div>
										<div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{p.desc}</div>
									</div>
								</button>
							))}
						</div>
					</div>

					{/* Reasoning Toggle */}
					<div
						onClick={() =>
							setSettings((prev) => ({ ...prev, enableReasoning: !prev.enableReasoning }))
						}
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							padding: "12px 14px",
							background: settings.enableReasoning
								? "rgba(139, 92, 246, 0.12)"
								: "rgba(255, 255, 255, 0.03)",
							border: settings.enableReasoning
								? "1px solid rgba(139, 92, 246, 0.35)"
								: "1px solid var(--border-subtle)",
							borderRadius: "var(--r-sm)",
							cursor: "pointer",
							userSelect: "none",
							transition: "all 0.2s ease",
						}}
					>
						<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
							<BrainIcon
								size={20}
								style={{
									color: settings.enableReasoning ? "var(--ai-spark)" : "var(--text-muted)",
									transition: "color 0.2s ease",
								}}
							/>
							<div>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "6px",
										fontSize: "13px",
										fontWeight: 600,
										color: "var(--text-primary)",
									}}
								>
									<span>Activar Razonamiento (Thinking)</span>
									<span
										style={{
											fontSize: "10px",
											padding: "1px 6px",
											borderRadius: "var(--r-full)",
											background: settings.enableReasoning
												? "rgba(139, 92, 246, 0.2)"
												: "rgba(255, 255, 255, 0.05)",
											color: settings.enableReasoning ? "var(--ai-spark)" : "var(--text-dim)",
											fontWeight: 500,
										}}
									>
										{settings.enableReasoning ? "Habilitado" : "Desactivado"}
									</span>
								</div>
								<div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
									{settings.enableReasoning
										? "El modelo mostrará su proceso de análisis paso a paso en una caja interactiva."
										: "Respuestas directas sin generar bloques <think>."}
								</div>
							</div>
						</div>
						<div className={`toggle-switch ${settings.enableReasoning ? "active" : ""}`}>
							<div className="toggle-knob" />
						</div>
					</div>

					{/* Temperature Slider */}
					<div>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: "4px",
							}}
						>
							<label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
								Temperatura (Creatividad)
							</label>
							<span
								style={{
									fontFamily: "var(--font-mono)",
									fontSize: "12px",
									fontWeight: 600,
									color: "var(--accent)",
								}}
							>
								{settings.temperature.toFixed(2)}
							</span>
						</div>
						<input
							type="range"
							min="0"
							max="2"
							step="0.05"
							value={settings.temperature}
							onChange={(e) =>
								setSettings((prev) => ({
									...prev,
									temperature: Number.parseFloat(e.target.value),
								}))
							}
							style={{ width: "100%", accentColor: "var(--accent)" }}
						/>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								fontSize: "10px",
								color: "var(--text-muted)",
							}}
						>
							<span>0.0 (Preciso / Código)</span>
							<span>0.7 (Balanceado)</span>
							<span>2.0 (Muy Creativo)</span>
						</div>
					</div>

					{/* Top P Slider */}
					<div>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: "4px",
							}}
						>
							<label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
								Top P (Nucleus Sampling)
							</label>
							<span
								style={{
									fontFamily: "var(--font-mono)",
									fontSize: "12px",
									fontWeight: 600,
									color: "var(--accent)",
								}}
							>
								{settings.topP.toFixed(2)}
							</span>
						</div>
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							value={settings.topP}
							onChange={(e) =>
								setSettings((prev) => ({ ...prev, topP: Number.parseFloat(e.target.value) }))
							}
							style={{ width: "100%", accentColor: "var(--accent)" }}
						/>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								fontSize: "10px",
								color: "var(--text-muted)",
							}}
						>
							<span>0.1 (Focalizado)</span>
							<span>0.9 (Estándar)</span>
							<span>1.0 (Sin filtro)</span>
						</div>
					</div>

					{/* Max Tokens Slider */}
					<div>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: "4px",
							}}
						>
							<label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
								Tokens Máximos de Respuesta
							</label>
							<span
								style={{
									fontFamily: "var(--font-mono)",
									fontSize: "12px",
									fontWeight: 600,
									color: "var(--accent)",
								}}
							>
								{settings.maxTokens}
							</span>
						</div>
						<input
							type="range"
							min="256"
							max="16384"
							step="256"
							value={settings.maxTokens}
							onChange={(e) =>
								setSettings((prev) => ({
									...prev,
									maxTokens: Number.parseInt(e.target.value, 10),
								}))
							}
							style={{ width: "100%", accentColor: "var(--accent)" }}
						/>
					</div>

					{/* Penalties Accordion / Row */}
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "1fr 1fr",
							gap: "12px",
							padding: "10px",
							background: "rgba(255, 255, 255, 0.02)",
							borderRadius: "var(--r-sm)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						<div>
							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									fontSize: "11px",
									fontWeight: 600,
									marginBottom: "4px",
								}}
							>
								<span>Penalidad de Frecuencia</span>
								<span>{settings.frequencyPenalty.toFixed(1)}</span>
							</div>
							<input
								type="range"
								min="-2"
								max="2"
								step="0.1"
								value={settings.frequencyPenalty}
								onChange={(e) =>
									setSettings((prev) => ({
										...prev,
										frequencyPenalty: Number.parseFloat(e.target.value),
									}))
								}
								style={{ width: "100%", accentColor: "var(--accent)" }}
							/>
						</div>

						<div>
							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									fontSize: "11px",
									fontWeight: 600,
									marginBottom: "4px",
								}}
							>
								<span>Penalidad de Presencia</span>
								<span>{settings.presencePenalty.toFixed(1)}</span>
							</div>
							<input
								type="range"
								min="-2"
								max="2"
								step="0.1"
								value={settings.presencePenalty}
								onChange={(e) =>
									setSettings((prev) => ({
										...prev,
										presencePenalty: Number.parseFloat(e.target.value),
									}))
								}
								style={{ width: "100%", accentColor: "var(--accent)" }}
							/>
						</div>
					</div>
				</div>

				{/* Modal Footer */}
				<div
					className="modal-footer"
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginTop: "16px",
					}}
				>
					<button
						type="button"
						className="btn-secondary"
						onClick={handleReset}
						style={{ display: "flex", alignItems: "center", gap: "6px" }}
					>
						<RotateCcwIcon size={14} />
						<span>Por defecto</span>
					</button>

					<div style={{ display: "flex", gap: "8px" }}>
						<button type="button" className="btn-secondary" onClick={onClose}>
							Cancelar
						</button>
						<button
							type="button"
							className="btn-primary"
							onClick={handleSave}
							style={{ display: "flex", alignItems: "center", gap: "6px" }}
						>
							<CheckIcon size={14} />
							<span>Aplicar configuración</span>
						</button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}
