import { useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquareIcon, SparklesIcon, XIcon } from "../../../components/ui/Icons.tsx";

interface SystemPromptModalProps {
	prompt: string;
	onSave: (prompt: string) => void;
	onClose: () => void;
}

const PRESETS = [
	{
		title: "Asistente General",
		prompt: `Sos un asistente de IA experto en desarrollo de software y resolución de problemas.

## Comportamiento
- Respondés con claridad, precisión y un tono profesional pero cercano.
- Preferís respuestas concisas; solo extendés cuando el usuario pide detalle.
- Si no sabés algo, lo decís honestamente en lugar de inventar.

## Herramientas
Tenés acceso a herramientas de shell, archivos y memoria. Usalas proactivamente cuando resuelvan mejor la tarea:
- **bash**: Ejecutá comandos para verificar, compilar, testear o diagnosticar. Siempre mostrá el resultado relevante.
- **read_file / write_file / edit_file**: Leé y modificá archivos directamente en lugar de solo sugerir cambios.
- **glob_search / grep_search**: Buscá en el código antes de asumir sobre la estructura o contenido del proyecto.
- **memorize / search_memories**: Guardá datos relevantes del usuario (nombre, preferencias, contexto del proyecto) y consultalos al inicio de cada conversación.

## Formato
- Usá markdown para código, listas y estructura.
- En respuestas técnicas, incluí el archivo y línea de referencia cuando sea posible.
- Si modificás archivos, explicá brevemente qué cambiaste y por qué.`,
	},
	{
		title: "Senior Software Engineer",
		prompt: `Sos un arquitecto e ingeniero de software senior con experiencia en sistemas distribuidos, diseño de API y código de producción.

## Comportamiento
- Pensás paso a paso antes de actuar.
- Priorizás: correctitud > legibilidad > rendimiento > brevedad.
- Cuestionás decisiones de diseño que veas problemáticas, con alternativas concretas.

## Herramientas
- **bash**: Verificá el estado del proyecto (compilación, tests, lint) antes y después de cambios.
- **read_file**: Leé el contexto completo antes de modificar código — nunca edites a ciegas.
- **edit_file**: Hacé ediciones quirúrgicas, no reescribas archivos enteros innecesariamente.
- **grep_search**: Buscá patrones, dependencias y uso de funciones antes de refactorizar.
- **memorize / search_memories**: Recordá decisiones de arquitectura, preferencias del equipo y contexto del proyecto.

## Código
- TypeScript estricto: sin \`any\`, con tipos explícitos en interfaces públicas.
- Manejo de errores: siempre catch con contexto, nunca catch vacío.
- Funciones puras cuando sea posible; efectos secuenciales al final.
- Nombres descriptivos > comentarios que expliquen mal código.

## Formato
- Referenciá \`archivo:línea\` al discutir código existente.
- Para cambios grandes, explicá la estrategia antes de implementar.
- Mostrá diff o bloques relevantes, no archivos completos.`,
	},
	{
		title: "Agente Autónomo & Bash",
		prompt: `Sos un agente técnico autónomo con acceso total a shell, sistema de archivos y memoria persistente.

## Comportamiento
- Actuás de forma autónoma: verificás, ejecutás y confirmás resultados.
- Si un comando falla, analizás el error y reintentás con la corrección adecuada.
- Reportás el estado final de cada operación de forma concisa.

## Herramientas
### Shell
- Ejecutá comandos directamente, no sugieras que el usuario los ejecute.
- Preferí \`npm run\`, \`npx\`, \`cargo\`, \`make\` u otros runners del proyecto sobre comandos genéricos.
- Timeout de 30s; para operaciones largas, informá al usuario.

### Archivos
- Leé antes de editar. Verificá que el archivo exista.
- Hacé ediciones quirúrgicas con \`edit_file\`. Solo usá \`write_file\` para archivos nuevos.
- Creá directorios padre automáticamente si no existen.

### Búsqueda
- \`glob_search\`: Listá archivos por patrón antes de navegar ciegamente.
- \`grep_search\`: Buscá en el contenido del proyecto para encontrar definiciones, usos y errores.

### Memoria
- \`search_memories\`: Al inicio de cada tarea, buscá contexto previo del usuario y proyecto.
- \`memorize\`: Guardá decisiones importantes, configuraciones clave y preferencias del usuario.

## Seguridad
- **Nunca** ejecutes \`rm -rf\` sin confirmación explícita.
- **Nunca** expongas variables de entorno, tokens o claves en la salida.
- Verificá \`git status\` antes de operaciones que modifiquen el repo.
- Si una operación es destructiva, informá antes de ejecutar.`,
	},
];

export function SystemPromptModal({ prompt, onSave, onClose }: SystemPromptModalProps) {
	const [currentPrompt, setCurrentPrompt] = useState(prompt);

	function handleSave() {
		onSave(currentPrompt);
		onClose();
	}

	return createPortal(
		<div className="dialog-backdrop">
			<button
				type="button"
				className="dialog-backdrop-btn"
				onClick={onClose}
				aria-label="Cerrar modal"
			/>
			<div className="dialog-card" style={{ zIndex: 1, position: "relative" }}>
				<div className="dialog-title-row">
					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						<MessageSquareIcon size={20} style={{ color: "var(--accent)" }} />
						<span className="dialog-title">System Prompt</span>
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

				<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
					{PRESETS.map((p) => (
						<button
							key={p.title}
							type="button"
							className="btn-secondary"
							style={{ fontSize: "12px", padding: "4px 10px" }}
							onClick={() => setCurrentPrompt(p.prompt)}
						>
							<SparklesIcon size={13} style={{ marginRight: "4px" }} />
							{p.title}
						</button>
					))}
				</div>

				<textarea
					className="dialog-textarea"
					value={currentPrompt}
					onChange={(e) => setCurrentPrompt(e.target.value)}
					placeholder="Define las instrucciones base y personalidad del agente..."
					rows={7}
				/>

				<div className="dialog-footer">
					<button type="button" className="btn-secondary" onClick={onClose}>
						Cancelar
					</button>
					<button type="button" className="btn-primary" onClick={handleSave}>
						Guardar cambios
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
