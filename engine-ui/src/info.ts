export const APP_VERSION = "0.1.0";

export interface ChangelogEntry {
	version: string;
	date?: string;
	title: string;
	items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
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
		title: "Estado",
		blocks: [
			{
				heading: "Panel principal",
				body: [
					"El dashboard se actualiza solo cada 3 segundos y muestra:",
					"· Modelo cargado y modelos GGUF registrados.",
					"· Throughput total en tokens por segundo (tok/s).",
					"· GPU: nombre, uso, temperatura, potencia y memoria VRAM.",
					"· Slots de inferencia activa con rendimiento por slot.",
				],
			},
			{
				heading: "Botón ( i )",
				body: [
					"Abre esta página: información del sistema, historial de versiones y este manual de uso.",
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
		title: "Solución de problemas",
		blocks: [
			{
				body: [
					"· Sin conexión: verificá que engine-api responda en http://localhost:3050/api/health.",
					"· 401: la x-api-key debe coincidir con la API_KEY del .env.",
					"· GPU no disponible: revisá que nvidia-container-toolkit esté instalado y que la opción runtime: nvidia esté activa.",
					"· Primer prompt lento: es el warmup del modelo; con GGUF cuantizado (p.ej. Q4_K_M) es más rápido.",
				],
			},
		],
	},
];
