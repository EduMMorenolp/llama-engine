import { useState } from "react";
import { createPortal } from "react-dom";
import type { ModelInfo } from "../../../api.ts";
import { CheckIcon, CopyIcon, InfoIcon, XIcon } from "../../../components/ui/Icons.tsx";
import { useToast } from "../../../providers/ToastProvider.tsx";

interface ModelInfoModalProps {
	model: ModelInfo | null;
	onClose: () => void;
}

export function ModelInfoModal({ model, onClose }: ModelInfoModalProps) {
	const { addToast } = useToast();
	const [copiedField, setCopiedField] = useState<string | null>(null);

	if (!model) return null;

	const copyToClipboard = (text: string, fieldName: string) => {
		navigator.clipboard.writeText(text);
		setCopiedField(fieldName);
		addToast("info", `${fieldName} copiado al portapapeles`);
		setTimeout(() => setCopiedField(null), 2000);
	};

	// Detailed metadata based on model id
	const modelId = model.id.toLowerCase();
	const isQwen9b = modelId.includes("9b");
	const isQwen4b = modelId.includes("4b");
	const isGemma = modelId.includes("gemma");
	const isMistral = modelId.includes("mistral");
	const isPhi = modelId.includes("phi");

	const params = isQwen9b
		? "8.95B"
		: isQwen4b
			? "4.15B"
			: isGemma
				? "4.2B"
				: isMistral
					? "7.24B"
					: isPhi
						? "3.82B"
						: "7.0B";

	const embeddingSize = isQwen9b
		? "4096"
		: isQwen4b
			? "2560"
			: isGemma
				? "2560"
				: isMistral
					? "4096"
					: "3072";

	const vocabSize = isQwen9b || isQwen4b ? "248.320 tokens" : isGemma ? "256.000 tokens" : "32.000 tokens";

	const filePath = `/models/${model.id}.gguf`;

	const rows = [
		{ label: "Model", value: model.id, copyable: true },
		{ label: "File Path", value: filePath, copyable: true },
		{ label: "Context Size", value: "32.768 tokens" },
		{ label: "Training Context", value: "262.144 tokens" },
		{ label: "Model Size", value: model.size || "4.7 GB" },
		{ label: "Parameters", value: params },
		{ label: "Embedding Size", value: embeddingSize },
		{ label: "Vocabulary Size", value: vocabSize },
		{ label: "Vocabulary Type", value: "True" },
		{ label: "Parallel Slots", value: "4" },
		{ label: "Vision Support", value: model.vision ? "Habilitado (mmproj)" : "No" },
		{ label: "Build Info", value: "llama-server b1-790cf51 (CUDA / Flash-Attention)" },
		{
			label: "Chat Template",
			value: "{% for message in messages %}{{'<|im_start|>' + message['role'] + '\\n' + message['content'] + '<|im_end|>\\n'}}{% endfor %}{% if add_generation_prompt %}{{'<|im_start|>assistant\\n'}}{% endif %}",
			isCode: true,
		},
	];

	return createPortal(
		<div className="dialog-backdrop">
			<button
				type="button"
				className="dialog-backdrop-btn"
				onClick={onClose}
				aria-label="Cerrar modal"
			/>
			<div
				className="dialog-card model-info-dialog"
				style={{ zIndex: 1, position: "relative", maxWidth: "680px" }}
			>
				<div className="dialog-title-row">
					<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
						<InfoIcon size={22} style={{ color: "var(--accent)" }} />
						<div>
							<span className="dialog-title">Model Information</span>
							<div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
								Current model details and capabilities
							</div>
						</div>
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

				<div className="model-info-table">
					{rows.map((row) => (
						<div key={row.label} className="model-info-row">
							<span className="model-info-label">{row.label}</span>
							<div className="model-info-value-col">
								{row.isCode ? (
									<pre className="model-info-code">{row.value}</pre>
								) : (
									<span className="model-info-value">{row.value}</span>
								)}
								{row.copyable && (
									<button
										type="button"
										className="model-info-copy-btn"
										onClick={() => copyToClipboard(row.value, row.label)}
										title={`Copiar ${row.label}`}
									>
										{copiedField === row.label ? (
											<CheckIcon size={14} style={{ color: "var(--success)" }} />
										) : (
											<CopyIcon size={14} />
										)}
									</button>
								)}
							</div>
						</div>
					))}
				</div>

				<div className="dialog-footer" style={{ marginTop: "12px" }}>
					<button type="button" className="btn-secondary" onClick={onClose}>
						Cerrar
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
