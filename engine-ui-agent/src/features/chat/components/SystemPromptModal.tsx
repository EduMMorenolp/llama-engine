import { useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquareIcon, SparklesIcon, XIcon } from "../../../components/ui/Icons.tsx";

interface SystemPromptModalProps {
	prompt: string;
	onSave: (prompt: string) => void;
	onClose: () => void;
}

const PRESETS = [
	{
		title: "Asistente General",
		prompt:
			"Eres un asistente de IA inteligente, empático y servicial. Respondes con claridad, precisión y un tono profesional.",
	},
	{
		title: "Senior Software Engineer",
		prompt:
			"Eres un arquitecto e ingeniero de software senior. Piensas paso a paso, priorizas código limpio, TypeScript seguro, manejo de errores robusto y explicaciones concisas.",
	},
	{
		title: "Agente Autónomo & Bash",
		prompt:
			"Eres un agente técnico con acceso a herramientas de shell y manipulación de archivos. Utilizas las herramientas con cuidado y verificas los resultados de cada acción.",
	},
];

export function SystemPromptModal({ prompt, onSave, onClose }: SystemPromptModalProps) {
	const [currentPrompt, setCurrentPrompt] = useState(prompt);

	function handleSave() {
		onSave(currentPrompt);
		onClose();
	}

	return createPortal(
		<div className="dialog-backdrop">
			<button
				type="button"
				className="dialog-backdrop-btn"
				onClick={onClose}
				aria-label="Cerrar modal"
			/>
			<div className="dialog-card" style={{ zIndex: 1, position: "relative" }}>
				<div className="dialog-title-row">
					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						<MessageSquareIcon size={20} style={{ color: "var(--accent)" }} />
						<span className="dialog-title">System Prompt</span>
					</div>
					<button
						type="button"
						className="session-action-btn"
						onClick={onClose}
						title="Cerrar modal"
						style={{ opacity: 1 }}
					>
						<XIcon size={18} />
					</button>
				</div>

				<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
					{PRESETS.map((p) => (
						<button
							key={p.title}
							type="button"
							className="btn-secondary"
							style={{ fontSize: "12px", padding: "4px 10px" }}
							onClick={() => setCurrentPrompt(p.prompt)}
						>
							<SparklesIcon size={13} style={{ marginRight: "4px" }} />
							{p.title}
						</button>
					))}
				</div>

				<textarea
					className="dialog-textarea"
					value={currentPrompt}
					onChange={(e) => setCurrentPrompt(e.target.value)}
					placeholder="Define las instrucciones base y personalidad del agente..."
					rows={7}
				/>

				<div className="dialog-footer">
					<button type="button" className="btn-secondary" onClick={onClose}>
						Cancelar
					</button>
					<button type="button" className="btn-primary" onClick={handleSave}>
						Guardar cambios
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
