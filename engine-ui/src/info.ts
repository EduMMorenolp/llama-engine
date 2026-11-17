export const APP_VERSION = "0.5.0";

export interface ChangelogEntry {
	version: string;
	date?: string;
	title: string;
	items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
	{
		version: "0.5.0",
		date: "2026-11-17",
		title: "Test & Benchmark Suite, Perfiles por Modelo, Playground Studio y Configuración",
		items: [
			"Nueva sección Test & Benchmark (/test): evaluación objetiva del modelo cargado con baterías de Velocidad/TTFT, Razonamiento, Código TypeScript, JSON estricto, Stress Test de Contexto, Visión Multimodal y Prompt Personalizado N-runs, con Leaderboard comparativo y exportación a Markdown.",
			"Sistema de Perfiles / Presets por modelo (models/presets.json): guardado de configuración óptima por GGUF y modos en 1 clic (Eco 8GB VRAM, Máxima Velocidad, Contexto 32K Coding, Multi-Agente).",
			"Playground Studio mejorado: historial de sesiones persistente, renderizado Markdown con bloques de código copiables, acordeón de pensamiento (<think> / reasoning_content), personas de sistema, pegado de imágenes (Ctrl+V) y guardado directo en DataSets.",
			"Nueva pantalla de Configuración (/configuracion): personalización de tema (Oscuro/Claro), 4 colores de acento (Emerald, Cyan, Amber, Violet), densidad de UI, barra lateral colapsable, credenciales API y exportación/importación de Workspace.",
			"Gestión avanzada en Modelos y DataSets: semáforo de compatibilidad VRAM en Hugging Face Hub, eliminación de archivos GGUF locales, creador interactivo de ejemplos en DataSets y curva de Loss en vivo durante el entrenamiento.",
		],
	},
	{
		version: "0.4.0",
		date: "2026-11-06",
		title: "Rediseño integral UI/UX, Playground Multimodal y Command Palette",
		items: [
			"Nuevo Playground Multimodal (/playground): chat en tiempo real con streaming SSE (/v1/chat/completions), soporte de imágenes base64 (mmproj), métricas tok/s por respuesta y exportación a JSONL.",
			"RuntimeContext compartido: elimina el polling duplicado, preserva el historial de telemetría entre pantallas y permite pausar o cambiar la frecuencia de actualización (3s/5s/10s).",
			"Paleta de comandos global (Ctrl+K) para navegar, cambiar de modelo GGUF en un clic y controlar el contenedor runtime.",
			"Sistema de notificaciones Toast, diálogos de confirmación (ConfirmDialog) y soporte completo para Modo Oscuro y Modo Claro.",
			"Visor de logs interactivo en Runtime con búsqueda en vivo, filtro por nivel, resaltado sintáctico, copia y descarga .log.",
			"Estimador de uso de VRAM en Modelos, filtros por capacidad (Visión/Texto), tabla de slots en Telemetría y generador de snippets API en Ayuda.",
		],
	},
	{
		version: "0.3.0",
		date: "2026-09-15",
		title: "Wizard de modelos y servicio llama-trainer",
		items: [
			"Asistente de Modelos con 3 flujos: crear desde cero, mejorar existente y optimizar rendimiento.",
			"Integración con llama-trainer: entrenamiento QLoRA, LoRA y full fine-tuning con monitoreo en tiempo real.",
			"Subida de datasets JSONL con soporte para formatos ShareGPT, OpenAI y Alpaca.",
			"Quantización integrada (Q3_K_M a Q8_0) con estimación de tamaño y opción imatrix.",
			"Deploy directo a /models con activación como modelo principal.",
			"Endpoints de trainer: datasets, train, quantize y health check.",
			"Fix: selector de modelos ahora preselecciona el modelo cargado en vez del primero de la lista.",
		],
	},
	{
		version: "0.2.0",
		date: "2026-08-10",
		title: "UI completa con sidebar y 5 pantallas",
		items: [
			"UI completa con sidebar y 5 pantallas (Dashboard, Modelos, Runtime, Telemetría, Ayuda).",
			"Selector de modelo con contexto y recarga; controles de runtime (restart/stop/start) y logs.",
			"Gráfico tok/s con Chart.js.",
			"Endpoints runtime/health, runtime/config, runtime/logs, runtime/stop, runtime/start en engine-api.",
		],
	},
	{
		version: "0.1.0",
		date: "2026-08-09",
		title: "Scaffold monorepo con Docker Compose",
		items: [
			"llama-runtime: build de llama-server desde fuente, CUDA 12.8 + Blackwell (sm_120), flash-attention y mmproj multimodal.",
			"engine-api: wrapper Express/TS con auth por API key, proxy /v1 OpenAI-compatible con streaming SSE, telemetría GPU (nvidia-smi), registry de GGUFs con detección de visión.",
			"engine-ui: SPA React 19/Vite con dashboard glassmorphism y poll de status cada 3s (modelo, throughput tok/s, GPU y slots).",
			"Docs de arquitectura, instalación e integración con opencode.",
			"Página de información del sistema, changelog de versiones y manual de uso (esta página).",
		],
	},
];

export interface ManualSection {
	title: string;
	blocks: { heading?: string; body: string[] }[];
}

export const MANUAL: ManualSection[] = [
	{
		title: "¿Qué es llama-engine?",
		blocks: [
			{
				body: [
					"Un motor local de LLMs sobre llama.cpp (llama-server) con API OpenAI-compatible, gestión vía Docker y una web de telemetría en tiempo real. Los modelos corren 100% en tu máquina, sin salir de tu red.",
				],
			},
		],
	},
	{
		title: "Pantallas",
		blocks: [
			{
				heading: "Dashboard",
				body: [
					"Centro de control ejecutivo: salud del runtime, modelo activo, velocidad de generación y prompt (tok/s), uso de VRAM, gráfico rápido de rendimiento y cambio directo de modelo.",
				],
			},
			{
				heading: "Playground",
				body: [
					"Estudio interactivo de chat e inferencia multimodal conectado a /v1/chat/completions con streaming SSE. Permite adjuntar imágenes para modelos con visión (mmproj), ajustar temperatura/system prompt y exportar conversaciones como dataset JSONL.",
				],
			},
			{
				heading: "Modelos GGUF",
				body: [
					"Registry de modelos locales con filtros por capacidad (visión/texto), estimación de encaje en VRAM, presets de contexto (4K a 64K) y explorador integrado de Hugging Face Hub.",
				],
			},
			{
				heading: "Runtime & Logs",
				body: [
					"Configuración efectiva del motor (engine + runtimeEnv), controles seguros con confirmación (Reiniciar/Stop/Start) y consola de logs con filtro en vivo y descarga.",
				],
			},
			{
				heading: "Telemetría",
				body: [
					"Gráficos de sesión (generación tok/s, prompt tok/s, utilización GPU y temperatura), tabla de slots concurrentes de llama-server y eficiencia energética (tok/s por Watt).",
				],
			},
			{
				heading: "Crear Modelo",
				body: [
					"Asistente paso a paso para crear, mejorar u optimizar modelos.",
					"Tres flujos disponibles: crear desde cero (con dataset propio), mejorar un modelo existente con nuevos ejemplos, u optimizar rendimiento mediante quantización.",
					"Soporta entrenamiento QLoRA, LoRA y full fine-tuning con monitoreo de loss y epochs en tiempo real.",
				],
			},
			{
				heading: "DataSets",
				body: [
					"Biblioteca de datasets de entrenamiento. Subí archivos .jsonl (ShareGPT, OpenAI o Alpaca) y quedan guardados en el trainer.",
					"Cada dataset se puede validar, previsualizar y borrar. Desde acá podés iniciar un entrenamiento con 'Crear modelo' o 'Mejorar modelo'.",
				],
			},
			{
				heading: "Ayuda & API",
				body: [
					"Esta página: generador de snippets listos para copiar (cURL, Python, TypeScript, opencode, Hermes), atajos de teclado, historial de versiones y manual de uso.",
				],
			},
		],
	},
	{
		title: "Usar el motor desde tu código",
		blocks: [
			{
				heading: "HTTP",
				body: [
					"El motor expone una API compatible con OpenAI en http://localhost:3050.",
					"GET /api/health — estado del servicio.",
					"GET /api/status — telemetría (GPU, slots, modelos) con x-api-key.",
					"POST /v1/chat/completions — chat streaming.",
				],
			},
			{
				heading: "Ejemplo de chat",
				body: [
					"curl -X POST http://localhost:3050/v1/chat/completions \\",
					'  -H "x-api-key: TU_API_KEY" -H "Content-Type: application/json" \\',
					'  -d \'{"model":"qwen3.5-4b","messages":[{"role":"user","content":"Hola"}]}\'',
				],
			},
		],
	},
	{
		title: "Integración con opencode y Hermes",
		blocks: [
			{
				body: [
					"Podés usar llama-engine como proveedor de modelos local en opencode y Hermes Agent apuntando baseURL a http://localhost:3050/v1.",
					"Detalle completo en docs/INTEGRACION-OPENCODE.md y docs/INTEGRACION-HERMES.md.",
				],
			},
		],
	},
	{
		title: "Cambiar entre modelos",
		blocks: [
			{
				body: [
					"Desde la pantalla Modelos (o con Ctrl+K desde cualquier lugar) seleccionás el modelo GGUF y su contexto (ctx) y pulsás Recargar.",
					"Equivalente por HTTP con la API key:",
					"curl -X POST http://localhost:3050/api/models/reload \\",
					'  -H "x-api-key: TU_API_KEY" -H "Content-Type: application/json" \\',
					'  -d \'{"modelId":"qwen3.5-4b","ctxSize":8192}\'',
				],
			},
		],
	},
	{
		title: "Agregar modelos",
		blocks: [
			{
				body: [
					"Descargá directamente desde la sección Hugging Face en la pantalla Modelos, o copiá un GGUF a la carpeta models/ con la convención <id>.gguf y, si tiene visión, mmproj-<id>.gguf.",
				],
			},
		],
	},
	{
		title: "Entrenar un modelo",
		blocks: [
			{
				heading: "DataSets",
				body: [
					"Administrá tus datasets desde la pantalla DataSets: subí el archivo, validalo y previsualizá los primeros ejemplos.",
					"Desde cada dataset, 'Crear modelo' o 'Mejorar modelo' abren el asistente con ese dataset ya seleccionado.",
				],
			},
			{
				heading: "Flujo crear desde cero",
				body: [
					"1. Elegí un modelo base desde Hugging Face o tu registry local.",
					"2. Elegí un dataset de tu biblioteca (pantalla DataSets) o subí uno nuevo en formato JSONL (ShareGPT, OpenAI o Alpaca).",
					"3. Configurá el método de entrenamiento (QLoRA recomendado para GPUs con VRAM limitada).",
					"4. Monitoreá el progreso: loss por epoch, líneas de log, barra de progreso.",
					"5. Quantizá el modelo entrenado (Q4_K_M recomendado para balance tamaño/calidad).",
					"6. Deployá a /models y activalo como modelo principal.",
				],
			},
			{
				heading: "Flujo mejorar modelo",
				body: [
					"Seleccioná un modelo registrado y subí datos de corrección o ejemplos adicionales.",
					"El wizard fine-tunea el modelo con los nuevos datos manteniendo las capacidades originales.",
				],
			},
			{
				heading: "Flujo optimizar rendimiento",
				body: [
					"Comprimí un modelo existente eligiendo el método de cuantización deseado.",
					"Opciones: Q3_K_M (más compacto), Q4_K_M (recomendado), Q5_K_M, Q6_K, Q8_0 (mayor calidad).",
					"Opcional: usar matriz de importancia (imatrix) para mejor preservación de calidad.",
				],
			},
		],
	},
	{
		title: "Solución de problemas",
		blocks: [
			{
				body: [
					"· Sin conexión: verificá que engine-api responda en http://localhost:3050/api/health.",
					"· 401: la x-api-key debe coincidir con la API_KEY del .env.",
					"· GPU no disponible: revisá que nvidia-container-toolkit esté instalado y que la opción runtime: nvidia esté activa.",
					"· Primer prompt lento: es el warmup del modelo; con GGUF cuantizado (p.ej. Q4_K_M) es más rápido.",
					"· Trainer no responde: verificá que el contenedor llama-trainer esté corriendo con docker compose ps.",
					"· GPU insuficiente para entrenamiento: QLoRA requiere ~6-8 GB VRAM para modelos 4B-7B; reducí batch_size o max_seq_len.",
				],
			},
		],
	},
];
