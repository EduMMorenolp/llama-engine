import { useEffect, useState } from "react";
import { type Dataset, listDatasets } from "../../api";
import { DatasetDropzone } from "../datasets/DatasetDropzone";
import { fmtBytes, fmtCount } from "../ui/helpers";

export type { Dataset };

export function DatasetStep({
	value,
	onChange,
	preselectId,
}: {
	value: Dataset | null;
	onChange: (ds: Dataset) => void;
	preselectId?: string;
}) {
	const [datasets, setDatasets] = useState<Dataset[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		listDatasets()
			.then((list) => {
				if (active) setDatasets(list);
			})
			.catch((err) => {
				if (active) setError(err instanceof Error ? err.message : String(err));
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		if (loading || value || !preselectId) return;
		const found = datasets.find((d) => d.id === preselectId);
		if (found) onChange(found);
	}, [loading, datasets, value, preselectId, onChange]);

	const handleUploaded = (ds: Dataset) => {
		setDatasets((prev) => [ds, ...prev.filter((d) => d.id !== ds.id)]);
		onChange(ds);
	};

	return (
		<div className="dataset-step">
			<h3>Elegí un dataset de entrenamiento</h3>
			<p className="muted">
				Seleccioná uno de tu biblioteca o subí un archivo nuevo (ShareGPT, OpenAI o Alpaca en
				JSONL).
			</p>

			{loading ? (
				<p className="muted" role="status">
					Cargando datasets…
				</p>
			) : error ? (
				<p className="feedback feedback-error" role="alert">
					{error}
				</p>
			) : datasets.length === 0 ? (
				<p className="muted" role="status">
					Todavía no hay datasets subidos. Usá "Subir un dataset nuevo" acá abajo.
				</p>
			) : (
				<ul className="dataset-library-list">
					{datasets.map((d) => (
						<li key={d.id}>
							<button
								type="button"
								className={`dataset-library-item ${value?.id === d.id ? "selected" : ""}`}
								onClick={() => onChange(d)}
								aria-pressed={value?.id === d.id}
							>
								<span className="dataset-library-name">{d.name}</span>
								<span className="dataset-library-meta">
									{d.format} · {fmtCount(d.examples)} ejemplos · {fmtBytes(d.sizeBytes)}
								</span>
								{value?.id === d.id ? <span className="model-tag">seleccionado</span> : null}
							</button>
						</li>
					))}
				</ul>
			)}

			<details className="dataset-upload">
				<summary>Subir un dataset nuevo</summary>
				<DatasetDropzone onUploaded={handleUploaded} />
			</details>

			{value ? (
				<div className="selected-model-banner">
					<span className="selected-label">Seleccionado:</span>
					<strong>{value.name}</strong>
					<span className="muted">
						({value.format} · {fmtCount(value.examples)} ejemplos)
					</span>
				</div>
			) : null}
		</div>
	);
}
