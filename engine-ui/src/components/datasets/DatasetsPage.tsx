import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	type Dataset,
	type DatasetPreview,
	deleteDataset,
	listDatasets,
	previewDataset,
	type ValidationResult,
	validateDataset,
} from "../../api";
import { Button } from "../ui/Button";
import { fmtBytes, fmtCount } from "../ui/helpers";
import { PageHeader, PageSection } from "../ui/PageHeader";
import { EmptyState, ErrorState, Loading } from "../ui/states";
import { DatasetDropzone } from "./DatasetDropzone";

export function DatasetsPage() {
	const navigate = useNavigate();
	const [datasets, setDatasets] = useState<Dataset[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const [validations, setValidations] = useState<Record<string, ValidationResult>>({});
	const [previews, setPreviews] = useState<Record<string, DatasetPreview>>({});
	const [busyRow, setBusyRow] = useState<string | null>(null);
	const [confirmId, setConfirmId] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setDatasets(await listDatasets());
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const handleUploaded = (ds: Dataset) => {
		setNotice(`Dataset "${ds.name}" subido (${fmtCount(ds.examples)} ejemplos)`);
		load();
	};

	const handleValidate = async (id: string) => {
		setBusyRow(id);
		setNotice(null);
		try {
			const res = await validateDataset(id);
			setValidations((prev) => ({ ...prev, [id]: res }));
		} catch (err) {
			setNotice(err instanceof Error ? err.message : String(err));
		} finally {
			setBusyRow(null);
		}
	};

	const handlePreview = async (id: string) => {
		setBusyRow(id);
		setNotice(null);
		try {
			const res = await previewDataset(id);
			setPreviews((prev) => ({ ...prev, [id]: res }));
		} catch (err) {
			setNotice(err instanceof Error ? err.message : String(err));
		} finally {
			setBusyRow(null);
		}
	};

	const handleDelete = async (id: string) => {
		setBusyRow(id);
		setNotice(null);
		try {
			await deleteDataset(id);
			setConfirmId(null);
			setDatasets((prev) => prev.filter((d) => d.id !== id));
			setNotice(`Dataset "${id}" eliminado`);
		} catch (err) {
			setNotice(err instanceof Error ? err.message : String(err));
		} finally {
			setBusyRow(null);
		}
	};

	const handleTrain = (id: string, flow: "create" | "improve") => {
		navigate(`/modelos/crear?flow=${flow}&datasetId=${encodeURIComponent(id)}`);
	};

	if (loading) return <Loading />;
	if (error) return <ErrorState error={error} onRetry={load} />;

	return (
		<div className="page-stack">
			<PageHeader
				title="DataSets"
				description="Biblioteca de datasets de entrenamiento (ShareGPT, OpenAI, Alpaca)"
			/>

			<PageSection title="Subir dataset">
				<DatasetDropzone onUploaded={handleUploaded} />
				{notice ? (
					<p className="feedback feedback-ok" role="status">
						{notice}
					</p>
				) : null}
			</PageSection>

			<PageSection title={`Biblioteca (${datasets.length})`}>
				{datasets.length === 0 ? (
					<EmptyState message="Todavía no hay datasets. Subí tu primer .jsonl arriba." />
				) : (
					<ul className="dataset-library">
						{datasets.map((d) => {
							const validation = validations[d.id];
							const preview = previews[d.id];
							const busy = busyRow === d.id;
							return (
								<li key={d.id} className="dataset-card">
									<div className="dataset-card-head">
										<div className="dataset-card-info">
											<h3 className="dataset-card-title">{d.name}</h3>
											<p className="muted">
												{d.id} · {d.format} · {fmtCount(d.examples)} ejemplos ·{" "}
												{fmtBytes(d.sizeBytes)}
											</p>
										</div>
										<div className="dataset-card-actions">
											<Button variant="ghost" busy={busy} onClick={() => handleValidate(d.id)}>
												Validar
											</Button>
											<Button variant="ghost" busy={busy} onClick={() => handlePreview(d.id)}>
												Previsualizar
											</Button>
											<Button onClick={() => handleTrain(d.id, "create")}>Crear modelo</Button>
											<Button onClick={() => handleTrain(d.id, "improve")}>Mejorar modelo</Button>
											{confirmId === d.id ? (
												<>
													<Button variant="danger" busy={busy} onClick={() => handleDelete(d.id)}>
														Confirmar
													</Button>
													<Button variant="ghost" onClick={() => setConfirmId(null)}>
														Cancelar
													</Button>
												</>
											) : (
												<Button variant="danger" onClick={() => setConfirmId(d.id)}>
													Borrar
												</Button>
											)}
										</div>
									</div>

									{validation ? (
										<div className={`dataset-validation ${validation.valid ? "ok" : "bad"}`}>
											<span className={`badge ${validation.valid ? "badge-on" : "badge-muted"}`}>
												{validation.valid ? "válido" : "con errores"}
											</span>
											<span className="muted">
												{validation.format} · {fmtCount(validation.examples)} ejemplos
											</span>
											{validation.errors.length > 0 ? (
												<ul className="dataset-errors">
													{validation.errors.map((msg) => (
														<li key={msg}>{msg}</li>
													))}
												</ul>
											) : null}
										</div>
									) : null}

									{preview ? (
										<div className="dataset-preview-panel">
											<h4>Preview ({preview.format})</h4>
											<div className="dataset-preview-scroll">
												{preview.examples.map((ex) => (
													<div
														key={`${d.id}-${ex.role}-${ex.content.slice(0, 40)}`}
														className="dataset-preview-item"
													>
														<span className={`preview-role ${ex.role}`}>{ex.role}:</span>
														<span className="preview-content">
															{ex.content.slice(0, 200)}
															{ex.content.length > 200 ? "..." : ""}
														</span>
													</div>
												))}
											</div>
										</div>
									) : null}
								</li>
							);
						})}
					</ul>
				)}
			</PageSection>
		</div>
	);
}
