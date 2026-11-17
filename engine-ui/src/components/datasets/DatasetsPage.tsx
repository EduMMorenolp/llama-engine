import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	appendDatasetExample,
	type Dataset,
	type DatasetPreview,
	deleteDataset,
	listDatasets,
	previewDataset,
	type ValidationResult,
	validateDataset,
} from "../../api";
import { useToast } from "../../context/ToastContext";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { fmtBytes, fmtCount } from "../ui/helpers";
import { IconCheck, IconDatabase, IconEye, IconPlus, IconSparkles, IconTrash } from "../ui/Icons";
import { PageHeader, PageSection } from "../ui/PageHeader";
import { EmptyState, ErrorState, Loading } from "../ui/states";
import { DatasetDropzone } from "./DatasetDropzone";

export function DatasetsPage() {
	const navigate = useNavigate();
	const toast = useToast();
	const [datasets, setDatasets] = useState<Dataset[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const [search, setSearch] = useState("");
	const [formatFilter, setFormatFilter] = useState<string>("all");

	const [validations, setValidations] = useState<Record<string, ValidationResult>>({});
	const [previews, setPreviews] = useState<Record<string, DatasetPreview>>({});
	const [busyRow, setBusyRow] = useState<string | null>(null);
	const [confirmId, setConfirmId] = useState<string | null>(null);

	// Creador interactivo de ejemplos
	const [builderOpen, setBuilderOpen] = useState(false);
	const [targetName, setTargetName] = useState("custom-dataset");
	const [sysText, setSysText] = useState("Sos un asistente experto y conciso.");
	const [userText, setUserText] = useState("");
	const [assistantText, setAssistantText] = useState("");
	const [savingExample, setSavingExample] = useState(false);

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
		void load();
	}, [load]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return datasets.filter((d) => {
			if (formatFilter !== "all" && d.format.toLowerCase() !== formatFilter.toLowerCase()) {
				return false;
			}
			if (q && !d.name.toLowerCase().includes(q) && !d.id.toLowerCase().includes(q)) {
				return false;
			}
			return true;
		});
	}, [datasets, search, formatFilter]);

	const totalExamples = useMemo(
		() => datasets.reduce((acc, d) => acc + (d.examples || 0), 0),
		[datasets],
	);
	const totalBytes = useMemo(
		() => datasets.reduce((acc, d) => acc + (d.sizeBytes || 0), 0),
		[datasets],
	);

	const handleUploaded = (ds: Dataset) => {
		const msg = `Dataset "${ds.name}" subido (${fmtCount(ds.examples)} ejemplos)`;
		setNotice(msg);
		toast.success("Dataset subido", msg);
		void load();
	};

	const handleValidate = async (id: string) => {
		setBusyRow(id);
		setNotice(null);
		try {
			const res = await validateDataset(id);
			setValidations((prev) => ({ ...prev, [id]: res }));
			if (res.valid) {
				toast.success("Dataset válido", `${res.format} · ${res.examples} ejemplos`);
			} else {
				toast.warning("Dataset con observaciones", `${res.errors.length} error(es) detectados`);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			setNotice(msg);
			toast.error("Error al validar", msg);
		} finally {
			setBusyRow(null);
		}
	};

	const handlePreview = async (id: string) => {
		if (previews[id]) {
			setPreviews((prev) => {
				const copy = { ...prev };
				delete copy[id];
				return copy;
			});
			return;
		}
		setBusyRow(id);
		setNotice(null);
		try {
			const res = await previewDataset(id, 6);
			setPreviews((prev) => ({ ...prev, [id]: res }));
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			setNotice(msg);
			toast.error("Error al previsualizar", msg);
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
			const msg = `Dataset "${id}" eliminado`;
			setNotice(msg);
			toast.info("Dataset eliminado", msg);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			setNotice(msg);
			toast.error("No se pudo eliminar", msg);
		} finally {
			setBusyRow(null);
		}
	};

	const handleTrain = (id: string, flow: "create" | "improve") => {
		navigate(`/modelos/crear?flow=${flow}&datasetId=${encodeURIComponent(id)}`);
	};

	const handleAppendExample = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!userText.trim() || !assistantText.trim()) return;
		setSavingExample(true);
		try {
			const messages = [
				...(sysText.trim() ? [{ role: "system", content: sysText.trim() }] : []),
				{ role: "user", content: userText.trim() },
				{ role: "assistant", content: assistantText.trim() },
			];
			const ds = await appendDatasetExample(targetName.trim() || "custom-dataset", messages);
			toast.success("Ejemplo agregado", `"${ds.name}" ahora tiene ${ds.examples} ejemplo(s).`);
			setUserText("");
			setAssistantText("");
			void load();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error("No se pudo guardar el ejemplo", msg);
		} finally {
			setSavingExample(false);
		}
	};

	if (loading) return <Loading />;
	if (error) return <ErrorState error={error} onRetry={load} />;

	return (
		<div className="page-stack">
			<PageHeader
				title="DataSets"
				description="Biblioteca de datasets de entrenamiento en formato JSONL (ShareGPT, OpenAI, Alpaca)"
				badge={`${datasets.length} archivos · ${fmtCount(totalExamples)} ejemplos`}
			/>

			<div className="metric-tiles">
				<div className="metric-tile">
					<span className="metric-label">Datasets en biblioteca</span>
					<span className="metric-value">{datasets.length}</span>
				</div>
				<div className="metric-tile">
					<span className="metric-label">Ejemplos totales</span>
					<span className="metric-value">{fmtCount(totalExamples)}</span>
				</div>
				<div className="metric-tile">
					<span className="metric-label">Espacio en disco</span>
					<span className="metric-value metric-value-text">{fmtBytes(totalBytes)}</span>
				</div>
			</div>

			<PageSection
				title="Subir o Construir Dataset"
				subtitle="Arrastrá archivos .jsonl / .json o redactá nuevos pares de instrucción/respuesta desde la interfaz"
				actions={
					<Button variant="ghost" size="sm" onClick={() => setBuilderOpen((v) => !v)}>
						<IconPlus size={14} />
						<span>{builderOpen ? "Ocultar Creador" : "Crear Ejemplo Manual"}</span>
					</Button>
				}
			>
				<DatasetDropzone onUploaded={handleUploaded} />
				{builderOpen ? (
					<form
						className="settings-stack"
						style={{ marginTop: "1rem" }}
						onSubmit={handleAppendExample}
					>
						<div className="config-grid">
							<div className="field">
								<label htmlFor="ds-target-id">Nombre del Dataset (.jsonl)</label>
								<input
									id="ds-target-id"
									type="text"
									value={targetName}
									onChange={(e) => setTargetName(e.target.value)}
									placeholder="custom-dataset"
								/>
							</div>
							<div className="field">
								<label htmlFor="ds-sys-input">System Prompt (opcional)</label>
								<input
									id="ds-sys-input"
									type="text"
									value={sysText}
									onChange={(e) => setSysText(e.target.value)}
								/>
							</div>
						</div>
						<div className="grid grid-2">
							<div className="field">
								<label htmlFor="ds-user-input">Mensaje Usuario (Instruction / Prompt)</label>
								<textarea
									id="ds-user-input"
									rows={3}
									value={userText}
									onChange={(e) => setUserText(e.target.value)}
									placeholder="Escribí la pregunta o instrucción de entrada…"
								/>
							</div>
							<div className="field">
								<label htmlFor="ds-asst-input">Respuesta Esperada del Asistente</label>
								<textarea
									id="ds-asst-input"
									rows={3}
									value={assistantText}
									onChange={(e) => setAssistantText(e.target.value)}
									placeholder="Escribí la respuesta ideal para entrenar al modelo…"
								/>
							</div>
						</div>
						<div className="action-row">
							<Button
								type="submit"
								variant="primary"
								busy={savingExample}
								disabled={!userText.trim() || !assistantText.trim()}
							>
								<IconPlus size={14} />
								<span>Guardar ejemplo en {targetName || "custom-dataset"}.jsonl</span>
							</Button>
						</div>
					</form>
				) : null}
				{notice ? (
					<p className="feedback feedback-ok" role="status">
						{notice}
					</p>
				) : null}
			</PageSection>

			<PageSection
				title={`Biblioteca (${filtered.length})`}
				subtitle="Validá la estructura de tus conversaciones o iniciá un job de fine-tuning directo"
				actions={
					datasets.length > 0 ? (
						<div className="table-filter-bar">
							<input
								type="search"
								className="input-sm"
								placeholder="Buscar dataset…"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
							<select
								className="select-sm"
								aria-label="Filtrar por formato"
								value={formatFilter}
								onChange={(e) => setFormatFilter(e.target.value)}
							>
								<option value="all">Todos los formatos</option>
								<option value="ShareGPT">ShareGPT</option>
								<option value="OpenAI">OpenAI</option>
								<option value="Alpaca">Alpaca</option>
							</select>
						</div>
					) : undefined
				}
			>
				{filtered.length === 0 ? (
					<EmptyState
						icon={<IconDatabase size={28} />}
						title="Sin datasets en esta vista"
						message={
							datasets.length === 0
								? "Todavía no hay datasets. Subí tu primer .jsonl arriba."
								: "Ningún dataset coincide con el filtro."
						}
					/>
				) : (
					<ul className="dataset-library">
						{filtered.map((d) => {
							const validation = validations[d.id];
							const preview = previews[d.id];
							const busy = busyRow === d.id;
							return (
								<li key={d.id} className="dataset-card">
									<div className="dataset-card-head">
										<div className="dataset-card-info">
											<div className="dataset-title-row">
												<h3 className="dataset-card-title mono">{d.name}</h3>
												<span className="badge badge-muted">{d.format}</span>
											</div>
											<p className="muted">
												ID: <span className="mono">{d.id}</span> · {fmtCount(d.examples)} ejemplos ·{" "}
												{fmtBytes(d.sizeBytes)}
											</p>
										</div>
										<div className="dataset-card-actions">
											<Button
												variant="ghost"
												size="sm"
												busy={busy}
												onClick={() => handleValidate(d.id)}
											>
												<IconCheck size={14} />
												<span>Validar</span>
											</Button>
											<Button
												variant="ghost"
												size="sm"
												busy={busy}
												onClick={() => handlePreview(d.id)}
											>
												<IconEye size={14} />
												<span>{preview ? "Ocultar preview" : "Previsualizar"}</span>
											</Button>
											<Button
												size="sm"
												variant="primary"
												onClick={() => handleTrain(d.id, "create")}
											>
												<IconSparkles size={14} />
												<span>Crear modelo</span>
											</Button>
											<Button size="sm" onClick={() => handleTrain(d.id, "improve")}>
												Mejorar modelo
											</Button>
											<Button variant="danger" size="sm" onClick={() => setConfirmId(d.id)}>
												<IconTrash size={14} />
												<span>Borrar</span>
											</Button>
										</div>
									</div>

									{validation ? (
										<div className={`dataset-validation ${validation.valid ? "ok" : "bad"}`}>
											<span className={`badge ${validation.valid ? "badge-on" : "badge-warn"}`}>
												{validation.valid ? "✓ válido" : "⚠ con errores"}
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
														key={`${d.id}-${ex.role}-${ex.content.slice(0, 48)}`}
														className="dataset-preview-item"
													>
														<span className={`preview-role ${ex.role}`}>{ex.role}:</span>
														<span className="preview-content">
															{ex.content.slice(0, 240)}
															{ex.content.length > 240 ? "…" : ""}
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

			<ConfirmDialog
				open={confirmId !== null}
				title="Eliminar dataset"
				description={`¿Seguro que querés eliminar el dataset "${confirmId}" del almacenamiento de llama-trainer? Esta acción no se puede deshacer.`}
				confirmLabel="Eliminar definitivamente"
				busy={busyRow === confirmId}
				onCancel={() => setConfirmId(null)}
				onConfirm={() => {
					if (confirmId) void handleDelete(confirmId);
				}}
			/>
		</div>
	);
}
