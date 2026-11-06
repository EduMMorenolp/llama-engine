import { useRef, useState } from "react";
import { type Dataset, uploadDataset } from "../../api";

const FORMAT_EXAMPLE = `// ShareGPT
{"conversations": [{"from":"human","value":"Hola"},{"from":"gpt","value":"¡Hola!"}]}

// OpenAI
{"messages": [{"role":"user","content":"Hola"},{"role":"assistant","content":"¡Hola!"}]}

// Alpaca
{"instruction":"Saluda","input":"","output":"¡Hola!"}`;

export function DatasetDropzone({ onUploaded }: { onUploaded: (ds: Dataset) => void }) {
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
			const ds = await uploadDataset(file);
			onUploaded(ds);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error al subir el dataset");
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

	const openPicker = () => fileRef.current?.click();

	return (
		<div className="dataset-dropzone-wrap">
			<input
				ref={fileRef}
				type="file"
				accept=".jsonl,.json"
				style={{ display: "none" }}
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) handleFile(file);
					e.target.value = "";
				}}
			/>
			<button
				type="button"
				className={`dataset-dropzone ${dragOver ? "drag-over" : ""}`}
				onDragOver={(e) => {
					e.preventDefault();
					setDragOver(true);
				}}
				onDragLeave={() => setDragOver(false)}
				onDrop={handleDrop}
				onClick={openPicker}
				aria-label="Subir dataset .jsonl o .json"
			>
				{uploading ? (
					<>
						<span className="spinner" aria-hidden="true" />
						<span>Subiendo…</span>
					</>
				) : (
					<>
						<div className="dropzone-icon" aria-hidden="true">
							📁
						</div>
						<div className="dropzone-text">
							Arrastrá un archivo <strong>.jsonl</strong> aquí
						</div>
						<div className="dropzone-sub">o click para seleccionar</div>
					</>
				)}
			</button>

			{error ? (
				<p className="feedback feedback-error" role="alert">
					{error}
				</p>
			) : null}

			<details className="format-hints">
				<summary className="muted">Formatos soportados</summary>
				<pre className="format-example">{FORMAT_EXAMPLE}</pre>
			</details>
		</div>
	);
}
