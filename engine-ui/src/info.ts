export const APP_VERSION = "0.3.0";

export interface ChangelogEntry {
	version: string;
	date?: string;
	title: string;
	items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
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
					"Métricas clave del motor: salud del runtime, modelo cargado, throughput total, uptime de la API, modelos registrados y un panel GPU compacto. Se actualiza solo cada 3 segundos.",
				],
			},
			{
				heading: "Modelos",
				body: [
					"Registry de modelos GGUF con selector de modelo, contexto (ctx) y recarga. Tabla de detalle por modelo y botones de reinicio del runtime.",
				],
			},
			{
				heading: "Runtime",
				body: [
					"Configuración efectiva del motor (engine + runtimeEnv), controles Reiniciar/Stop/Start y vista de logs con tail configurable.",
				],
			},
			{
				heading: "Telemetría",
				body: [
					"Specs del sistema (versión, uptime, modelo), panel GPU detallado (VRAM, temperatura, potencia, uso) y gráfico de historial de tok/s acumulado durante la sesión.",
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
			heading: "Ayuda",
			body: ["Esta página: historial de versiones y manual de uso."],
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
		title: "Integración con opencode",
		blocks: [
			{
				body: [
					'Podés usar llama-engine como proveedor de modelos local. Registrá el proveedor "llama" (baseURL http://localhost:3050/v1) en tu opencode.json y seleccioná el modelo, por ejemplo: opencode --model llama/qwen3.5-4b.',
					"Detalle completo en docs/INTEGRACION-OPENCODE.md.",
				],
			},
		],
	},
	{
		title: "Cambiar entre modelos",
		blocks: [
			{
				body: [
					"Desde la pantalla Modelos seleccionás el modelo GGUF y su contexto (ctx) y pulsás Recargar. El runtime recarga el modelo elegido sin reiniciar el contenedor.",
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
					"Copiá un GGUF a la carpeta models/ con la convención <id>.gguf y, si tiene visión, mmproj-<id>.gguf. El registro lo detecta automáticamente al reiniciar el servicio.",
					"Ver docs/INSTALL.md para descargar y montar modelos.",
				],
			},
		],
	},
	{
		title: "Entrenar un modelo",
		blocks: [
			{
				heading: "Flujo crear desde cero",
				body: [
					"1. Elegí un modelo base desde Hugging Face o tu registry local.",
					"2. Subí un dataset en formato JSONL (ShareGPT, OpenAI o Alpaca).",
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
					"Opcional: usar imagen de calibración (imatrix) para mejor preservación de calidad.",
				],
			},
			{
				heading: "Servicio llama-trainer",
				body: [
					"El entrenamiento corre en un contenedor Docker separado (llama-trainer) con GPU dedicada.",
					"API interna en http://localhost:8081 con endpoints para datasets, entrenamiento y quantización.",
					"Los modelos entrenados se exportan a GGUF y se montan automáticamente en /models.",
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
				"· Error 'No module named trainer': reconstruí el contenedor con docker compose build llama-trainer.",
				"· GPU insuficiente para entrenamiento: QLoRA requiere ~6 GB VRAM para modelos 7B; reduce batch_size o max_seq_len.",
				],
			},
		],
	},
];
