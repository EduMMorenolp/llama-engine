import { useRef, useState } from "react";

export interface DatasetInfo {
	id: string;
	name: string;
	examples: number;
	format: string;
	preview: Array<{ role: string; content: string }>;
}

export function DatasetStep({
	value,
	onChange,
}: {
	value: DatasetInfo | null;
	onChange: (ds: DatasetInfo) => void;
}) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [dragOver, setDragOver] = useState(false);

	const handleFile = async (file: File) => {
		if (!file.name.endsWith(".jsonl") && !file.name.endsWith(".json")) {
			setError("El archivo debe ser .jsonl o .json");
			return;
		}
		setUploading(true);
		setError(null);
		try {
			const text = await file.text();
			const parsed = parseJsonl(text);
			if (parsed.examples.length === 0) {
				setError("El archivo no contiene ejemplos válidos");
				return;
			}
			onChange({
				id: file.name.replace(/\.(jsonl|json)$/, ""),
				name: file.name,
				examples: parsed.examples.length,
				format: parsed.format,
				preview: parsed.preview,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error al parsear el archivo");
		} finally {
			setUploading(false);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(false);
		const file = e.dataTransfer.files[0];
		if (file) handleFile(file);
	};

	return (
		<div className="dataset-step">
			<h3>Subí tu dataset de entrenamiento</h3>
			<p className="muted">Formatos: ShareGPT, OpenAI ChatML, o Alpaca (JSONL)</p>

			<div
				className={`dataset-dropzone ${dragOver ? "drag-over" : ""}`}
				onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
				onDragLeave={() => setDragOver(false)}
				onDrop={handleDrop}
				onClick={() => fileRef.current?.click()}
				onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
				role="button"
				tabIndex={0}
			>
				<input
					ref={fileRef}
					type="file"
					accept=".jsonl,.json"
					style={{ display: "none" }}
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) handleFile(file);
					}}
				/>
				{uploading ? (
					<>
						<span className="spinner" />
						<span>Procesando...</span>
					</>
				) : (
					<>
						<div className="dropzone-icon">📁</div>
						<div className="dropzone-text">
							Arrastrá un archivo <strong>.jsonl</strong> aquí
						</div>
						<div className="dropzone-sub">o click para seleccionar</div>
					</>
				)}
			</div>

			{error && <p className="feedback feedback-error">{error}</p>}

			{value && (
				<div className="dataset-preview-panel">
					<div className="dataset-stats">
						<span className="stat-badge">✅ Formato: {value.format}</span>
						<span className="stat-badge">{value.examples} ejemplos</span>
					</div>

					<h4>Preview</h4>
					<div className="dataset-preview-scroll">
						{value.preview.slice(0, 3).map((ex, i) => (
							<div key={i} className="dataset-preview-item">
								<span className={`preview-role ${ex.role}`}>{ex.role}:</span>
								<span className="preview-content">{ex.content.slice(0, 200)}{ex.content.length > 200 ? "..." : ""}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{!value && (
				<div className="format-hints">
					<h4>Ejemplos de formato</h4>
					<pre className="format-example">{`// ShareGPT
{"conversations": [{"from":"human","value":"Hola"},{"from":"gpt","value":"¡Hola!"}]}

// OpenAI
{"messages": [{"role":"user","content":"Hola"},{"role":"assistant","content":"¡Hola!"}]}

// Alpaca
{"instruction":"Saluda","input":"","output":"¡Hola!"}`}</pre>
				</div>
			)}
		</div>
	);
}

function parseJsonl(text: string): { format: string; examples: Array<unknown>; preview: Array<{ role: string; content: string }> } {
	const lines = text.split("\n").filter((l) => l.trim());
	const examples: Array<Record<string, unknown>> = [];
	let format = "desconocido";
	const preview: Array<{ role: string; content: string }> = [];

	for (const line of lines.slice(0, 100)) {
		try {
			const obj = JSON.parse(line);
			examples.push(obj);

			if (examples.length <= 3) {
				if (obj.conversations) {
					format = "ShareGPT";
					const conv = obj.conversations[0];
					if (conv) preview.push({ role: conv.from ?? "unknown", content: conv.value ?? "" });
				} else if (obj.messages) {
					format = "OpenAI";
					const msg = obj.messages[0];
					if (msg) preview.push({ role: msg.role ?? "unknown", content: msg.content ?? "" });
				} else if (obj.instruction) {
					format = "Alpaca";
					preview.push({ role: "user", content: obj.instruction });
					if (obj.output) preview.push({ role: "assistant", content: obj.output });
				}
			}
		} catch {
			// skip invalid lines
		}
	}

	return { format, examples, preview };
}
