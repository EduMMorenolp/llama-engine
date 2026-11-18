import { useState } from "react";
import {
	DEFAULT_API_KEY,
	DEFAULT_API_URL,
	fetchStatus,
	getApiKey,
	getApiUrl,
	setApiCredentials,
} from "../../api";
import {
	type AccentColor,
	type ThemeMode,
	type UiDensity,
	useTheme,
} from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { useRuntime } from "../../hooks/useRuntime";
import { APP_VERSION } from "../../info";
import { Button } from "../ui/Button";
import {
	IconCheck,
	IconCopy,
	IconDownload,
	IconEye,
	IconEyeOff,
	IconMoon,
	IconRefresh,
	IconSave,
	IconSun,
	IconTrash,
	IconUpload,
} from "../ui/Icons";
import { PageHeader, PageSection } from "../ui/PageHeader";

const ACCENT_OPTIONS: { id: AccentColor; label: string; color: string; desc: string }[] = [
	{
		id: "emerald",
		label: "NVIDIA Emerald",
		color: "#34d399",
		desc: "Acento original CUDA/Blackwell",
	},
	{
		id: "cyan",
		label: "Blackwell Cyan",
		color: "#22d3ee",
		desc: "Alto contraste técnico de precisión",
	},
	{
		id: "amber",
		label: "Amber Forge",
		color: "#f59e0b",
		desc: "Cálido industrial estilo telemetría",
	},
	{
		id: "violet",
		label: "Violet Pulse",
		color: "#a78bfa",
		desc: "Estética sintética de laboratorio",
	},
];

export function SettingsPage() {
	const toast = useToast();
	const {
		theme,
		setTheme,
		accent,
		setAccent,
		density,
		setDensity,
		sidebarCollapsed,
		setSidebarCollapsed,
	} = useTheme();
	const { pollMs, setPollMs, paused, setPaused, refresh, clearSeries } = useRuntime();

	const [apiUrl, setApiUrlState] = useState(() => getApiUrl());
	const [apiKey, setApiKeyState] = useState(() => getApiKey());
	const [showApiKey, setShowApiKey] = useState(false);
	const [copiedApiKey, setCopiedApiKey] = useState(false);
	const [testingConn, setTestingConn] = useState(false);
	const [connLatency, setConnLatency] = useState<number | null>(null);

	const handleCopyApiKey = async () => {
		if (!apiKey) return;
		try {
			await navigator.clipboard.writeText(apiKey);
			setCopiedApiKey(true);
			toast.success("API Key copiada", "La clave se copió al portapapeles.");
			setTimeout(() => setCopiedApiKey(false), 2000);
		} catch {
			toast.error("Error al copiar", "No se pudo acceder al portapapeles.");
		}
	};

	const handleSaveApi = async (e: React.FormEvent) => {
		e.preventDefault();
		setApiCredentials(apiUrl, apiKey);
		setTestingConn(true);
		const t0 = performance.now();
		try {
			await fetchStatus();
			const ms = Math.round(performance.now() - t0);
			setConnLatency(ms);
			toast.success("Conexión verificada", `engine-api respondió en ${ms} ms`);
			refresh();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error("Fallo al conectar con engine-api", msg);
		} finally {
			setTestingConn(false);
		}
	};

	const handleResetApi = () => {
		setApiCredentials("", "");
		setApiUrlState(DEFAULT_API_URL);
		setApiKeyState(DEFAULT_API_KEY);
		setConnLatency(null);
		toast.info("Credenciales restablecidas", "Se usan los valores por defecto del entorno.");
		refresh();
	};

	const handleExportWorkspace = () => {
		const dump: Record<string, unknown> = {
			exportedAt: new Date().toISOString(),
			version: APP_VERSION,
			preferences: {
				theme,
				accent,
				density,
				pollMs,
			},
			sessions: JSON.parse(window.localStorage.getItem("llama-engine-chat-sessions") ?? "[]"),
			benchmarks: JSON.parse(window.localStorage.getItem("llama-engine-benchmarks") ?? "[]"),
			customPrompts: JSON.parse(window.localStorage.getItem("llama-engine-custom-prompts") ?? "[]"),
		};
		const blob = new Blob([JSON.stringify(dump, null, "\t")], {
			type: "application/json;charset=utf-8",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `llama-engine-workspace-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success("Respaldo exportado", "Tus sesiones, benchmarks y preferencias se descargaron.");
	};

	const handleImportWorkspace = (file: File) => {
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const parsed = JSON.parse(String(reader.result ?? "{}")) as {
					preferences?: {
						theme?: ThemeMode;
						accent?: AccentColor;
						density?: UiDensity;
						pollMs?: number;
					};
					sessions?: unknown[];
					benchmarks?: unknown[];
					customPrompts?: unknown[];
				};
				if (parsed.preferences?.theme) setTheme(parsed.preferences.theme);
				if (parsed.preferences?.accent) setAccent(parsed.preferences.accent);
				if (parsed.preferences?.density) setDensity(parsed.preferences.density);
				if (parsed.preferences?.pollMs) setPollMs(parsed.preferences.pollMs);
				if (Array.isArray(parsed.sessions)) {
					window.localStorage.setItem(
						"llama-engine-chat-sessions",
						JSON.stringify(parsed.sessions),
					);
				}
				if (Array.isArray(parsed.benchmarks)) {
					window.localStorage.setItem("llama-engine-benchmarks", JSON.stringify(parsed.benchmarks));
				}
				if (Array.isArray(parsed.customPrompts)) {
					window.localStorage.setItem(
						"llama-engine-custom-prompts",
						JSON.stringify(parsed.customPrompts),
					);
				}
				toast.success(
					"Workspace restaurado",
					"Se importaron tus sesiones, benchmarks y preferencias visuales.",
				);
			} catch {
				toast.error("Archivo inválido", "No se pudo leer el respaldo JSON.");
			}
		};
		reader.readAsText(file);
	};

	const handleClearLocalData = () => {
		window.localStorage.removeItem("llama-engine-chat-sessions");
		window.localStorage.removeItem("llama-engine-benchmarks");
		clearSeries();
		toast.info(
			"Historial local limpiado",
			"Se vaciaron las sesiones y el historial de telemetría.",
		);
	};

	return (
		<div className="page-stack">
			<PageHeader
				title="Configuración & Personalización"
				description="Adaptá la interfaz, los temas, el color de acento, la frecuencia de telemetría y las credenciales del motor"
				badge={`v${APP_VERSION}`}
			/>

			<div className="grid grid-2">
				<PageSection
					title="Apariencia & Sistema de Diseño"
					subtitle="Personalizá el tema visual, el color de acento y la densidad de información"
				>
					<div className="settings-stack">
						<div className="field">
							<span className="field-label">Modo de Tema</span>
							<div className="segmented-control">
								<button
									type="button"
									className={`seg-btn ${theme === "dark" ? "active" : ""}`}
									onClick={() => setTheme("dark")}
								>
									<IconMoon size={14} />
									<span>Oscuro (Obsidian)</span>
								</button>
								<button
									type="button"
									className={`seg-btn ${theme === "light" ? "active" : ""}`}
									onClick={() => setTheme("light")}
								>
									<IconSun size={14} />
									<span>Claro (Paper)</span>
								</button>
							</div>
						</div>

						<div className="field">
							<span className="field-label">Color de Acento Principal</span>
							<div className="accent-swatch-grid">
								{ACCENT_OPTIONS.map((opt) => (
									<button
										key={opt.id}
										type="button"
										className={`accent-swatch-card ${accent === opt.id ? "active" : ""}`}
										onClick={() => setAccent(opt.id)}
									>
										<span
											className="accent-swatch-dot"
											style={{ background: opt.color }}
											aria-hidden="true"
										/>
										<div className="accent-swatch-info">
											<strong>{opt.label}</strong>
											<span className="muted small">{opt.desc}</span>
										</div>
										{accent === opt.id ? <IconCheck size={14} className="accent-text" /> : null}
									</button>
								))}
							</div>
						</div>

						<div className="field">
							<span className="field-label">Densidad de Interfaz</span>
							<div className="segmented-control">
								<button
									type="button"
									className={`seg-btn ${density === "comfortable" ? "active" : ""}`}
									onClick={() => setDensity("comfortable")}
								>
									<span>Confortable (Estándar)</span>
								</button>
								<button
									type="button"
									className={`seg-btn ${density === "compact" ? "active" : ""}`}
									onClick={() => setDensity("compact")}
								>
									<span>Compacta (Alta densidad)</span>
								</button>
							</div>
						</div>

						<label className="checkbox-label">
							<input
								type="checkbox"
								checked={sidebarCollapsed}
								onChange={(e) => setSidebarCollapsed(e.target.checked)}
							/>
							<span>Barra lateral en modo compacto (solo iconos en escritorio)</span>
						</label>
					</div>
				</PageSection>

				<PageSection
					title="Conexión con engine-api & Telemetría"
					subtitle="Configurá la URL del backend, la API Key y la frecuencia de muestreo"
				>
					<form className="settings-stack" onSubmit={handleSaveApi}>
						<div className="field">
							<label htmlFor="cfg-api-url">URL de engine-api</label>
							<input
								id="cfg-api-url"
								type="url"
								value={apiUrl}
								onChange={(e) => setApiUrlState(e.target.value)}
								placeholder="http://localhost:3050"
							/>
							<span className="field-hint">
								Por defecto: <code className="mono">{DEFAULT_API_URL}</code>
							</span>
						</div>

						<div className="field">
							<label htmlFor="cfg-api-key">API Key (x-api-key)</label>
							<div className="input-action-group">
								<input
									id="cfg-api-key"
									type={showApiKey ? "text" : "password"}
									value={apiKey}
									onChange={(e) => setApiKeyState(e.target.value)}
									placeholder="llama-engine-dev"
									autoComplete="off"
									spellCheck={false}
								/>
								<button
									type="button"
									className="input-action-btn"
									onClick={() => setShowApiKey((v) => !v)}
									title={showApiKey ? "Ocultar API Key" : "Mostrar API Key"}
									aria-label={showApiKey ? "Ocultar API Key" : "Mostrar API Key"}
								>
									{showApiKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
								</button>
								<button
									type="button"
									className="input-action-btn"
									onClick={handleCopyApiKey}
									title="Copiar API Key al portapapeles"
									aria-label="Copiar API Key al portapapeles"
								>
									{copiedApiKey ? (
										<IconCheck size={16} className="accent-text" />
									) : (
										<IconCopy size={16} />
									)}
								</button>
							</div>
							<span className="field-hint">
								Se almacena localmente en tu navegador para autenticar llamadas a /api y /v1.
							</span>
						</div>

						<div className="field">
							<label htmlFor="cfg-poll">Intervalo de Muestreo (Polling GPU & Slots)</label>
							<select
								id="cfg-poll"
								value={paused ? "paused" : String(pollMs)}
								onChange={(e) => {
									if (e.target.value === "paused") setPaused(true);
									else {
										setPaused(false);
										setPollMs(Number(e.target.value));
									}
								}}
							>
								<option value="2000">Cada 2 segundos (Tiempo real)</option>
								<option value="3000">Cada 3 segundos (Recomendado)</option>
								<option value="5000">Cada 5 segundos (Ahorro)</option>
								<option value="10000">Cada 10 segundos</option>
								<option value="paused">Pausado (Solo actualización manual)</option>
							</select>
						</div>

						<div className="action-row">
							<Button type="submit" variant="primary" busy={testingConn}>
								<IconSave size={14} />
								<span>Guardar y Probar Conexión</span>
							</Button>
							<Button type="button" variant="ghost" onClick={handleResetApi}>
								<IconRefresh size={14} />
								<span>Restaurar por defecto</span>
							</Button>
							{connLatency !== null ? (
								<span className="badge badge-on">Latencia: {connLatency} ms</span>
							) : null}
						</div>
					</form>
				</PageSection>
			</div>

			<PageSection
				title="Respaldo de Sesiones, Benchmarks y Preferencias"
				subtitle="Exportá o importá tus conversaciones del Playground, resultados de la sección Test y ajustes visuales"
			>
				<div className="action-row">
					<Button variant="primary" onClick={handleExportWorkspace}>
						<IconDownload size={15} />
						<span>Exportar Workspace (.json)</span>
					</Button>

					<label className="btn btn-default btn-md" style={{ cursor: "pointer" }}>
						<IconUpload size={15} />
						<span>Importar Workspace (.json)</span>
						<input
							type="file"
							accept=".json,application/json"
							style={{ display: "none" }}
							onChange={(e) => {
								const f = e.target.files?.[0];
								if (f) handleImportWorkspace(f);
								e.target.value = "";
							}}
						/>
					</label>

					<Button variant="danger" onClick={handleClearLocalData}>
						<IconTrash size={15} />
						<span>Limpiar historial de sesiones y benchmarks</span>
					</Button>
				</div>
			</PageSection>

			<PageSection title="Acerca de Llama Engine" subtitle="Especificaciones de la plataforma">
				<div className="metric-tiles">
					<div className="metric-tile">
						<span className="metric-label">Versión UI</span>
						<span className="metric-value metric-value-text">v{APP_VERSION}</span>
						<span className="metric-sub">React 19 + Vite 6 + TypeScript</span>
					</div>
					<div className="metric-tile">
						<span className="metric-label">Motor de Inferencia</span>
						<span className="metric-value metric-value-text">llama.cpp</span>
						<span className="metric-sub">CUDA 12.8 · Blackwell sm_120 · FlashAttn</span>
					</div>
					<div className="metric-tile">
						<span className="metric-label">Compatibilidad API</span>
						<span className="metric-value metric-value-text">OpenAI /v1</span>
						<span className="metric-sub">opencode · Hermes Agent · SDKs oficiales</span>
					</div>
					<div className="metric-tile">
						<span className="metric-label">Fine-Tuning & Quant</span>
						<span className="metric-value metric-value-text">llama-trainer</span>
						<span className="metric-sub">QLoRA / LoRA + llama-quantize + imatrix</span>
					</div>
				</div>
			</PageSection>
		</div>
	);
}
