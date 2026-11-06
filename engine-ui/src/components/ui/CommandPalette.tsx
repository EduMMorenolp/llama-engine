import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useModels } from "../../hooks/useModels";
import { useRuntime } from "../../hooks/useRuntime";
import { fmtBytes } from "./helpers";
import {
	IconActivity,
	IconCpu,
	IconDashboard,
	IconDatabase,
	IconHelp,
	IconModels,
	IconMoon,
	IconPlay,
	IconPlayground,
	IconRefresh,
	IconSearch,
	IconSparkles,
	IconStop,
	IconSun,
	IconX,
} from "./Icons";

interface CommandItem {
	id: string;
	group: string;
	label: string;
	sub?: string;
	icon: ReactNode;
	keywords: string;
	onSelect: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
	const navigate = useNavigate();
	const { status, refresh, paused, setPaused } = useRuntime();
	const actions = useModels(status?.models ?? [], refresh);
	const { theme, toggleTheme } = useTheme();

	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (open) {
			setQuery("");
			setActiveIndex(0);
			window.setTimeout(() => inputRef.current?.focus(), 20);
		}
	}, [open]);

	const items = useMemo<CommandItem[]>(() => {
		const go = (path: string) => () => {
			navigate(path);
			onClose();
		};

		const navItems: CommandItem[] = [
			{
				id: "nav-dashboard",
				group: "Navegación",
				label: "Ir a Dashboard",
				sub: "Resumen general, KPIs y estado del motor",
				icon: <IconDashboard size={16} />,
				keywords: "home inicio dashboard metricas kpi",
				onSelect: go("/"),
			},
			{
				id: "nav-playground",
				group: "Navegación",
				label: "Abrir Playground Multimodal",
				sub: "Chat en vivo SSE y pruebas de visión (/v1)",
				icon: <IconPlayground size={16} />,
				keywords: "chat playground inferencia prompt vision probar",
				onSelect: go("/playground"),
			},
			{
				id: "nav-models",
				group: "Navegación",
				label: "Ir a Modelos GGUF",
				sub: "Registry local, contexto y Hugging Face Hub",
				icon: <IconModels size={16} />,
				keywords: "modelos gguf huggingface descargar recargar",
				onSelect: go("/modelos"),
			},
			{
				id: "nav-wizard",
				group: "Navegación",
				label: "Asistente de Modelos (Crear / Mejorar / Quantizar)",
				sub: "Flujo paso a paso con QLoRA, LoRA e imatrix",
				icon: <IconSparkles size={16} />,
				keywords: "crear entrenar wizard qlora lora quantizar",
				onSelect: go("/modelos/crear"),
			},
			{
				id: "nav-datasets",
				group: "Navegación",
				label: "Ir a Biblioteca de DataSets",
				sub: "Gestión de archivos JSONL (ShareGPT, OpenAI, Alpaca)",
				icon: <IconDatabase size={16} />,
				keywords: "datasets datos jsonl sharegpt alpaca",
				onSelect: go("/datasets"),
			},
			{
				id: "nav-runtime",
				group: "Navegación",
				label: "Ir a Runtime y Logs",
				sub: "Variables LLAMA_*, ciclo de vida y consola de logs",
				icon: <IconCpu size={16} />,
				keywords: "runtime contenedor docker logs variables",
				onSelect: go("/runtime"),
			},
			{
				id: "nav-telemetry",
				group: "Navegación",
				label: "Ir a Telemetría Avanzada",
				sub: "Gráficos tok/s, slots activos y sensores GPU",
				icon: <IconActivity size={16} />,
				keywords: "telemetria gpu vram temperatura graficos slots",
				onSelect: go("/telemetria"),
			},
			{
				id: "nav-help",
				group: "Navegación",
				label: "Ir a Ayuda y Snippets API",
				sub: "Manual, cURL, Python, opencode, Hermes y changelog",
				icon: <IconHelp size={16} />,
				keywords: "ayuda manual documentacion api curl changelog",
				onSelect: go("/ayuda"),
			},
		];

		const modelItems: CommandItem[] = (status?.models ?? []).map((m) => ({
			id: `model-${m.id}`,
			group: "Cargar Modelo GGUF",
			label: `Cargar ${m.id}`,
			sub: `${m.vision ? "Visión + Texto" : "Texto"} · ${fmtBytes(m.sizeBytes)}${m.id === status?.loadedModel ? " · Activo actualmente" : ""}`,
			icon: <IconModels size={16} />,
			keywords: `modelo cargar reload ${m.id} ${m.vision ? "vision" : "texto"}`,
			onSelect: () => {
				actions.reload(m.id);
				onClose();
			},
		}));

		const actionItems: CommandItem[] = [
			{
				id: "act-refresh",
				group: "Acciones Rápidas",
				label: "Actualizar telemetría ahora",
				sub: "Forzar lectura inmediata de /api/status",
				icon: <IconRefresh size={16} />,
				keywords: "refresh actualizar poll status",
				onSelect: () => {
					refresh();
					onClose();
				},
			},
			{
				id: "act-pause-poll",
				group: "Acciones Rápidas",
				label: paused ? "Reanudar auto-refresh de telemetría" : "Pausar auto-refresh de telemetría",
				sub: paused ? "Reactivar polling periódico" : "Detener temporalmente las consultas",
				icon: <IconActivity size={16} />,
				keywords: "pausar reanudar polling auto refresh",
				onSelect: () => {
					setPaused(!paused);
					onClose();
				},
			},
			{
				id: "act-theme",
				group: "Acciones Rápidas",
				label: theme === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro",
				sub: "Alternar apariencia visual de la interfaz",
				icon: theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />,
				keywords: "tema modo claro oscuro dark light apariencia",
				onSelect: () => {
					toggleTheme();
					onClose();
				},
			},
			{
				id: "act-restart",
				group: "Control del Runtime",
				label: "Reiniciar contenedor llama-runtime",
				sub: "Ejecuta POST /api/runtime/restart",
				icon: <IconRefresh size={16} />,
				keywords: "reiniciar restart runtime docker",
				onSelect: () => {
					actions.restart();
					onClose();
				},
			},
			{
				id: "act-start",
				group: "Control del Runtime",
				label: "Iniciar contenedor llama-runtime",
				sub: "Ejecuta POST /api/runtime/start",
				icon: <IconPlay size={16} />,
				keywords: "iniciar start runtime",
				onSelect: () => {
					actions.start();
					onClose();
				},
			},
			{
				id: "act-stop",
				group: "Control del Runtime",
				label: "Detener contenedor llama-runtime",
				sub: "Ejecuta POST /api/runtime/stop",
				icon: <IconStop size={16} />,
				keywords: "detener stop apagar runtime",
				onSelect: () => {
					actions.stop();
					onClose();
				},
			},
		];

		return [...navItems, ...modelItems, ...actionItems];
	}, [
		status?.models,
		status?.loadedModel,
		navigate,
		onClose,
		actions,
		refresh,
		paused,
		setPaused,
		theme,
		toggleTheme,
	]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return items;
		return items.filter(
			(it) =>
				it.label.toLowerCase().includes(q) ||
				it.sub?.toLowerCase().includes(q) ||
				it.keywords.toLowerCase().includes(q),
		);
	}, [items, query]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			} else if (e.key === "ArrowDown") {
				e.preventDefault();
				setActiveIndex((i) => (filtered.length > 0 ? (i + 1) % filtered.length : 0));
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setActiveIndex((i) =>
					filtered.length > 0 ? (i - 1 + filtered.length) % filtered.length : 0,
				);
			} else if (e.key === "Enter" && filtered[activeIndex]) {
				e.preventDefault();
				filtered[activeIndex].onSelect();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, filtered, activeIndex, onClose]);

	if (!open) return null;

	return (
		<div className="modal-backdrop">
			<div className="cmd-dialog" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
				<div className="cmd-search-bar">
					<IconSearch size={18} className="muted" />
					<input
						ref={inputRef}
						type="search"
						className="cmd-input"
						placeholder="Ir a pantalla, cargar modelo GGUF o ejecutar acción…"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setActiveIndex(0);
						}}
					/>
					<button
						type="button"
						className="icon-btn icon-btn-sm"
						onClick={onClose}
						aria-label="Cerrar paleta"
					>
						<IconX size={15} />
					</button>
				</div>

				<div className="cmd-list" role="listbox">
					{filtered.length === 0 ? (
						<p className="cmd-empty muted">No hay comandos que coincidan con "{query}"</p>
					) : (
						filtered.map((item, idx) => {
							const showGroup = idx === 0 || filtered[idx - 1].group !== item.group;
							return (
								<div key={item.id}>
									{showGroup ? <div className="cmd-group-title">{item.group}</div> : null}
									<button
										type="button"
										role="option"
										aria-selected={idx === activeIndex}
										className={`cmd-item ${idx === activeIndex ? "active" : ""}`}
										onMouseEnter={() => setActiveIndex(idx)}
										onClick={item.onSelect}
									>
										<span className="cmd-item-icon">{item.icon}</span>
										<span className="cmd-item-text">
											<span className="cmd-item-label">{item.label}</span>
											{item.sub ? <span className="cmd-item-sub">{item.sub}</span> : null}
										</span>
										<kbd className="kbd">↵</kbd>
									</button>
								</div>
							);
						})
					)}
				</div>

				<div className="cmd-footer">
					<span>
						<kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> navegar
					</span>
					<span>
						<kbd className="kbd">↵</kbd> ejecutar
					</span>
					<span>
						<kbd className="kbd">Esc</kbd> cerrar
					</span>
				</div>
			</div>
		</div>
	);
}
