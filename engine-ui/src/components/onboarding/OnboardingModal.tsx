import { useState } from "react";
import { Button } from "../ui/Button";
import {
	IconCheck,
	IconChevronLeft,
	IconChevronRight,
	IconCpu,
	IconDashboard,
	IconGauge,
	IconModels,
	IconPlayground,
	IconX,
} from "../ui/Icons";

export const ONBOARDING_STORAGE_KEY = "llama-engine-onboarding-completed";

export function openOnboardingTour() {
	window.dispatchEvent(new CustomEvent("llama-engine-open-tour"));
}

interface TourStep {
	title: string;
	subtitle: string;
	icon: React.ReactNode;
	content: React.ReactNode;
	badge: string;
}

export function OnboardingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
	const [currentStep, setCurrentStep] = useState(0);
	const [dontShowAgain, setDontShowAgain] = useState(true);

	if (!isOpen) return null;

	const steps: TourStep[] = [
		{
			title: "Bienvenido a llama-engine",
			subtitle: "Inferencia local de alto rendimiento con privacidad total",
			badge: "Paso 1 de 6 · Introducción",
			icon: <IconDashboard size={28} className="accent-text" />,
			content: (
				<div className="onboarding-step-body">
					<p>
						<strong>llama-engine</strong> es tu plataforma de ejecución y control para Modelos de
						Lenguaje (LLMs) corriendo <strong>100% en tu máquina</strong>, sobre el motor nativo{" "}
						<code>llama.cpp</code> con aceleración CUDA para GPUs NVIDIA.
					</p>
					<div className="onboarding-highlights-grid">
						<div className="onboarding-highlight-card">
							<span className="onboarding-highlight-tag">Privacidad Absoluta</span>
							<p>Tus datos, prompts y documentos nunca salen de tu red local ni de tu GPU.</p>
						</div>
						<div className="onboarding-highlight-card">
							<span className="onboarding-highlight-tag">OpenAI-Compatible</span>
							<p>Conectá Cursor, VS Code Continue, Claude Code, Python o TypeScript sin cambios.</p>
						</div>
						<div className="onboarding-highlight-card">
							<span className="onboarding-highlight-tag">Zero Cloud Costs</span>
							<p>
								Inferencia ilimitada sin suscripciones, límites de tokens ni rate-limits de
								terceros.
							</p>
						</div>
					</div>
				</div>
			),
		},
		{
			title: "Modelos GGUF & Perfiles de 1 Clic",
			subtitle: "Carga óptima adaptada a tu hardware y memoria VRAM",
			badge: "Paso 2 de 6 · Modelos",
			icon: <IconModels size={28} className="accent-text" />,
			content: (
				<div className="onboarding-step-body">
					<p>
						En la pantalla <strong>Modelos GGUF</strong> podés gestionar los modelos locales de la
						carpeta <code>models/</code> y aplicar perfiles preconfigurados en un solo clic:
					</p>
					<ul className="onboarding-list">
						<li>
							<strong>Eco VRAM (8GB):</strong> Quantiza la memoria KV Cache a <code>q4_0</code> para
							permitir ventanas de contexto de hasta 65K tokens en placas de 8GB sin saturar.
						</li>
						<li>
							<strong>Máxima Velocidad:</strong> Configurado con 1 slot y parámetros balanceados
							para máxima tasa de generación (tok/s).
						</li>
						<li>
							<strong>Contexto Largo (32K/64K):</strong> Ideal para análisis de repositorios de
							código y documentos extensos.
						</li>
						<li>
							<strong>Multi-Agente:</strong> Configura múltiples slots paralelos para flujos
							concurrentes.
						</li>
					</ul>
					<p className="small muted">
						También contás con un buscador integrado para explorar y descargar modelos directamente
						desde Hugging Face con semáforo de compatibilidad de VRAM.
					</p>
				</div>
			),
		},
		{
			title: "Playground Studio & Visión Multimodal",
			subtitle: "Interacción en tiempo real con streaming y soporte de imágenes",
			badge: "Paso 3 de 6 · Playground",
			icon: <IconPlayground size={28} className="accent-text" />,
			content: (
				<div className="onboarding-step-body">
					<p>
						El <strong>Playground Studio</strong> te ofrece una experiencia conversacional completa
						conectada a <code>/v1/chat/completions</code>:
					</p>
					<ul className="onboarding-list">
						<li>
							<strong>Streaming SSE en vivo:</strong> Respuestas fluidas con telemetría de velocidad
							(tok/s) y tiempo hasta el primer token (TTFT).
						</li>
						<li>
							<strong>Soporte Multimodal:</strong> Pegá capturas o imágenes con <code>Ctrl+V</code>{" "}
							para interactuar con modelos de visión (vía proyector <code>mmproj</code>).
						</li>
						<li>
							<strong>Modelos de Razonamiento:</strong> Acordeón interactivo para visualizar el
							pensamiento interno (<code>&lt;think&gt;</code>) de modelos como Qwen 2.5 / DeepSeek.
						</li>
						<li>
							<strong>Generador de DataSets:</strong> Guardá cualquier intercambio directamente a tu
							biblioteca de datasets con un solo clic.
						</li>
					</ul>
				</div>
			),
		},
		{
			title: "Test & Benchmark Suite (/test)",
			subtitle: "Evaluación objetiva del rendimiento y calidad de tus modelos",
			badge: "Paso 4 de 6 · Benchmark",
			icon: <IconGauge size={28} className="accent-text" />,
			content: (
				<div className="onboarding-step-body">
					<p>
						No adivines qué modelo rinde mejor. La suite de <strong>Test & Benchmark</strong>{" "}
						ejecuta baterías de pruebas estandarizadas:
					</p>
					<div className="onboarding-highlights-grid">
						<div className="onboarding-highlight-card">
							<span className="onboarding-highlight-tag">Velocidad & TTFT</span>
							<p>Mide la latencia de primer token y la velocidad sostenida de generación.</p>
						</div>
						<div className="onboarding-highlight-card">
							<span className="onboarding-highlight-tag">Código & JSON Estricto</span>
							<p>Verifica que el modelo produzca sintaxis TypeScript y JSON 100% válido.</p>
						</div>
						<div className="onboarding-highlight-card">
							<span className="onboarding-highlight-tag">Leaderboard & Reportes</span>
							<p>
								Guarda una tabla histórica comparativa y permite exportar resultados a Markdown.
							</p>
						</div>
					</div>
				</div>
			),
		},
		{
			title: "Telemetría en Vivo & Hardware",
			subtitle: "Sensores GPU NVIDIA, CPU del Host y memoria RAM",
			badge: "Paso 5 de 6 · Telemetría",
			icon: <IconCpu size={28} className="accent-text" />,
			content: (
				<div className="onboarding-step-body">
					<p>
						La pantalla de <strong>Telemetría</strong> está conectada en tiempo real vía{" "}
						<code>/api/ws</code> (WebSocket):
					</p>
					<ul className="onboarding-list">
						<li>
							<strong>Sensores GPU:</strong> Porcentaje de uso CUDA, temperatura térmica (°C),
							consumo energético (Watts) y barra de VRAM.
						</li>
						<li>
							<strong>Sensores de tu PC:</strong> Monitoreo de carga de CPU y memoria RAM del
							sistema en tiempo real.
						</li>
						<li>
							<strong>Selectores de tiempo independientes:</strong> Cada gráfico tiene su propio
							dropdown (2m, 5m, 15m, 30m, Todo) con inspección precisa al pasar el cursor.
						</li>
					</ul>
				</div>
			),
		},
		{
			title: "Integraciones API & Atajos de Teclado",
			subtitle: "Conectá tu stack y navegá a máxima velocidad",
			badge: "Paso 6 de 6 · Listo para Empezar",
			icon: <IconCheck size={28} className="accent-text" />,
			content: (
				<div className="onboarding-step-body">
					<p>
						Todo está listo para que aproveches <strong>llama-engine</strong> al máximo:
					</p>
					<div className="onboarding-highlights-grid">
						<div className="onboarding-highlight-card">
							<span className="onboarding-highlight-tag">Atajo Global</span>
							<p>
								Presioná <kbd>Ctrl+K</kbd> en cualquier momento para abrir la Paleta de Comandos y
								cambiar de modelo o pantalla en un segundo.
							</p>
						</div>
						<div className="onboarding-highlight-card">
							<span className="onboarding-highlight-tag">Snippets en Ayuda</span>
							<p>
								En <strong>Ayuda & API</strong> encontrás ejemplos listos para copiar en cURL,
								Python, TypeScript, opencode y Hermes.
							</p>
						</div>
						<div className="onboarding-highlight-card">
							<span className="onboarding-highlight-tag">Repasar Guía</span>
							<p>
								Podés volver a abrir este tour interactivo cuando quieras haciendo clic en el botón
								de bienvenida dentro de <strong>Ayuda & API</strong>.
							</p>
						</div>
					</div>
				</div>
			),
		},
	];

	const handleFinish = () => {
		if (dontShowAgain) {
			try {
				window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
			} catch {}
		}
		onClose();
	};

	const handleNext = () => {
		if (currentStep < steps.length - 1) {
			setCurrentStep((prev) => prev + 1);
		} else {
			handleFinish();
		}
	};

	const handlePrev = () => {
		if (currentStep > 0) {
			setCurrentStep((prev) => prev - 1);
		}
	};

	const step = steps[currentStep];

	return (
		<div className="onboarding-overlay" role="dialog" aria-modal="true">
			<div className="onboarding-modal card">
				<div className="onboarding-header">
					<div className="onboarding-header-left">
						<div className="onboarding-icon-wrap">{step.icon}</div>
						<div>
							<span className="badge badge-subtle">{step.badge}</span>
							<h2 className="onboarding-title">{step.title}</h2>
							<p className="onboarding-subtitle muted small">{step.subtitle}</p>
						</div>
					</div>
					<button
						type="button"
						className="icon-btn"
						onClick={handleFinish}
						aria-label="Cerrar tour"
					>
						<IconX size={18} />
					</button>
				</div>

				<div className="onboarding-content">{step.content}</div>

				<div className="onboarding-footer">
					<div className="onboarding-progress-dots">
						{steps.map((s, idx) => (
							<button
								key={s.badge}
								type="button"
								className={`onboarding-dot ${idx === currentStep ? "active" : ""} ${idx < currentStep ? "done" : ""}`}
								onClick={() => setCurrentStep(idx)}
								title={`Ir al paso ${idx + 1}`}
							/>
						))}
					</div>

					<div className="onboarding-footer-actions">
						<label className="checkbox-label small">
							<input
								type="checkbox"
								checked={dontShowAgain}
								onChange={(e) => setDontShowAgain(e.target.checked)}
							/>
							<span>No volver a mostrar automáticamente</span>
						</label>

						<div className="action-row">
							{currentStep > 0 && (
								<Button variant="ghost" size="sm" onClick={handlePrev}>
									<IconChevronLeft size={14} />
									<span>Anterior</span>
								</Button>
							)}

							<Button variant="primary" size="sm" onClick={handleNext}>
								<span>{currentStep === steps.length - 1 ? "Comenzar a Usar" : "Siguiente"}</span>
								{currentStep < steps.length - 1 && <IconChevronRight size={14} />}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
