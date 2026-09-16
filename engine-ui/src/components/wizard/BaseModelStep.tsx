import { useState } from "react";
import { searchHf, type HubModel, fetchHfRepo } from "../../api";
import { useRuntime } from "../../hooks/useRuntime";
import { Button } from "../ui/Button";
import { fmtBytes, fmtCount } from "../ui/helpers";

export interface BaseModelSelection {
	source: "hf" | "local";
	id: string;
	name: string;
}

export function BaseModelStep({
	value,
	onChange,
	flow,
}: {
	value: BaseModelSelection | null;
	onChange: (sel: BaseModelSelection) => void;
	flow: "create" | "improve" | "optimize";
}) {
	const { status } = useRuntime();
	const registry = status?.models ?? [];

	const [tab, setTab] = useState<"hf" | "local">(flow === "create" ? "hf" : "local");
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<HubModel[]>([]);
	const [searching, setSearching] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [loadingDetail, setLoadingDetail] = useState(false);

	const handleSearch = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!query.trim()) return;
		setSearching(true);
		setSearchError(null);
		try {
			setResults(await searchHf(query));
		} catch (err) {
			setSearchError(err instanceof Error ? err.message : String(err));
			setResults([]);
		} finally {
			setSearching(false);
		}
	};

	const openDetail = async (m: HubModel) => {
		setLoadingDetail(true);
		setSearchError(null);
		try {
			await fetchHfRepo(m.owner, m.name);
		} catch (err) {
			setSearchError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoadingDetail(false);
		}
	};

	const selectHfModel = (m: HubModel) => {
		onChange({ source: "hf", id: m.id, name: m.id });
	};

	const selectLocalModel = (m: { id: string; sizeBytes: number }) => {
		onChange({ source: "local", id: m.id, name: m.id });
	};

	return (
		<div className="model-step">
			<h3>Seleccioná el modelo base</h3>

			<div className="step-tabs">
				<button
					type="button"
					className={`step-tab ${tab === "hf" ? "active" : ""}`}
					onClick={() => setTab("hf")}
				>
					HuggingFace
				</button>
				<button
					type="button"
					className={`step-tab ${tab === "local" ? "active" : ""}`}
					onClick={() => setTab("local")}
				>
					Modelos locales
				</button>
			</div>

			{tab === "hf" && (
				<div className="hf-panel">
					<form className="hf-search-form" onSubmit={handleSearch}>
						<input
							type="search"
							placeholder="Buscar en HuggingFace (qwen3, llama, mistral...)"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
						<Button type="submit" busy={searching} disabled={!query.trim()}>
							Buscar
						</Button>
					</form>

					{searchError && <p className="feedback feedback-error">{searchError}</p>}

					{results.length > 0 && (
						<ul className="hf-results-list">
							{results.map((m) => (
								<li
									key={m.id}
									className={`hf-result-item ${value?.id === m.id ? "selected" : ""}`}
									onClick={() => selectHfModel(m)}
									onKeyDown={(e) => e.key === "Enter" && selectHfModel(m)}
									role="button"
									tabIndex={0}
								>
									<div className="hf-result-info">
										<span className="hf-result-id">{m.id}</span>
										<span className="hf-result-meta">
											{fmtCount(m.downloads)} descargas · {fmtCount(m.likes)} likes
										</span>
									</div>
									<Button variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(m); }} busy={loadingDetail}>
										Detalles
									</Button>
								</li>
							))}
						</ul>
					)}

					{!searching && query && results.length === 0 && !searchError && (
						<p className="muted">sin resultados para "{query}"</p>
					)}
				</div>
			)}

			{tab === "local" && (
				<div className="local-panel">
					{registry.length === 0 ? (
						<p className="muted">No hay modelos locales en /models. Subí GGUFs o descargá desde HuggingFace.</p>
					) : (
						<ul className="local-models-list">
							{registry.map((m) => (
								<li
									key={m.id}
									className={`local-model-item ${value?.id === m.id ? "selected" : ""}`}
									onClick={() => selectLocalModel(m)}
									onKeyDown={(e) => e.key === "Enter" && selectLocalModel(m)}
									role="button"
									tabIndex={0}
								>
									<span className="local-model-id">{m.id}</span>
									<span className="local-model-meta">
										{m.vision ? "vision · " : ""}{fmtBytes(m.sizeBytes)}
									</span>
									{m.id === status?.loadedModel && <span className="model-tag">cargado</span>}
								</li>
							))}
						</ul>
					)}
				</div>
			)}

			{value && (
				<div className="selected-model-banner">
					<span className="selected-label">Seleccionado:</span>
					<strong>{value.name}</strong>
					<span className="muted">({value.source === "hf" ? "HuggingFace" : "local"})</span>
				</div>
			)}
		</div>
	);
}
