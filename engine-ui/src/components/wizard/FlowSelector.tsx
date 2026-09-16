export interface FlowOption {
	id: "create" | "improve" | "optimize";
	icon: string;
	title: string;
	description: string;
	detail: string;
}

const FLOWS: FlowOption[] = [
	{
		id: "create",
		icon: "🆕",
		title: "Crear modelo",
		description: "Entrená un modelo desde cero con tu propio dataset",
		detail: "Elegí un modelo base, subí tus datos y entrená un modelo personalizado con QLoRA/LoRA.",
	},
	{
		id: "improve",
		icon: "📈",
		title: "Mejorar modelo",
		description: "Ajustá un modelo existente con nuevos ejemplos",
		detail: "Seleccioná un modelo registrado y fine-tunelo con datos de corrección o ejemplos adicionales.",
	},
	{
		id: "optimize",
		icon: "⚡",
		title: "Optimizar rendimiento",
		description: "Comprimí un modelo manteniendo la calidad",
		detail: "Quantizá un modelo a Q4_K_M, Q5_K_M o Q6_K para reducir tamaño y mejorar velocidad.",
	},
];

export function FlowSelector({
	selected,
	onSelect,
}: {
	selected: "create" | "improve" | "optimize" | null;
	onSelect: (flow: "create" | "improve" | "optimize") => void;
}) {
	return (
		<div className="flow-selector">
			<h2 className="flow-selector-title">¿Qué querés hacer?</h2>
			<div className="flow-cards">
				{FLOWS.map((flow) => (
					<button
						key={flow.id}
						type="button"
						className={`flow-card ${selected === flow.id ? "selected" : ""}`}
						onClick={() => onSelect(flow.id)}
					>
						<div className="flow-icon">{flow.icon}</div>
						<div className="flow-title">{flow.title}</div>
						<div className="flow-desc">{flow.description}</div>
						<div className="flow-detail">{flow.detail}</div>
					</button>
				))}
			</div>
		</div>
	);
}
