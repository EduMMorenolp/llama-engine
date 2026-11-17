# Changelog

Todas las entradas notables del proyecto.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y el proyecto se adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-08-10

### Added
- **engine-ui**: UI completa con sidebar y 5 pantallas enrutadas (react-router): Dashboard, Modelos, Runtime, Telemetría y Ayuda.
  - Selector de modelo GGUF con contexto (ctx) y recarga; tabla de detalle por modelo (visión/tamaño/estado).
  - Controles de runtime (Reiniciar/Stop/Start) con estados busy e inline feedback en Modelos y Runtime.
  - Vista de logs del runtime con tail configurable y actualización manual.
  - Gráfico tok/s con Chart.js (serie acumulada de hasta 60 muestras del poll) y panel GPU en Telemetría.
  - Tokens CSS semánticos, escala de spacing de 4px, tipografía delimitada; acceso por teclado, `aria-current`, estados loading/empty/error por pantalla.
  - Página de información del sistema: specs en vivo, changelog y manual (contenido de `info.ts`).
- **engine-api**: endpoints de gestión del runtime (auth):
  - `RuntimeManager`: `stop()`, `start()`, `logs(tail)` (demultiplexado Docker, clamp 1..500) y `getEnv()`.
  - `GET /api/runtime/health` → `{ running, healthy, loadedModel, ctxSize }`.
  - `GET /api/runtime/config` → engine + `runtimeEnv` (solo `LLAMA_*`; nunca `apiKey` ni vars con KEY/PASS/SECRET).
  - `GET /api/runtime/logs?tail=N` → `{ lines }` (N default 100, clamp 1..500).
  - `POST /api/runtime/stop` y `POST /api/runtime/start`.
  - `StatusService`: `isHealthy()` y `ctxSize()` públicos. Demux de logs cubierto por tests unitarios.

## [Unreleased]

- **engine-ui**: Lanzamiento v0.5.0 — **Test & Benchmark Suite (`/test`)**, **Playground Studio**, **Perfiles por Modelo** y **Configuración (`/configuracion`)**:
  - Nueva pantalla **Test & Benchmark (`/test`)**: baterías de pruebas automatizadas (Velocidad/TTFT, Razonamiento lógico, Generación de código TypeScript, Adherencia a JSON estricto, Stress Test de contexto largo *Needle in a Haystack*, Test Multimodal de Visión y Prompt personalizado multi-pasada `N-runs`), cálculo de **Score Global (0–100 / S, A, B, C)**, cruce con telemetría térmica/energética, **Leaderboard comparativo** con gráfico `Chart.js` y exportación de reportes en Markdown (`.md`).
  - **Playground Studio mejorado**: historial de múltiples sesiones persistente en `localStorage`, renderizado rico de **Markdown** con bloques de código copiables, acordeón interactivo de pensamiento (`<think>` y `reasoning_content`), selector de **Personas / System Prompts**, pegado directo de imágenes (`Ctrl+V`), parámetros de muestreo extendidos (`Top-K`, `Min-P`, `Repeat Penalty`, `JSON Mode`), regeneración de respuestas y botón **Guardar en DataSet**.
  - **Perfiles de optimización en 1 clic y gestión de modelos (`/modelos`)**: modos *Eco VRAM (8 GB Safe)*, *Máxima Velocidad*, *Contexto Largo (32K Coding)* y *Multi-Agente (4 Slots)*, guardado de presets persistentes por modelo (`PUT /api/models/:id/preset`), eliminación de modelos GGUF locales (`DELETE /api/models/:id`), detección de `mmproj` huérfanos y **semáforo de compatibilidad VRAM** al explorar repositorios en Hugging Face.
  - **Nueva pantalla de Configuración (`/configuracion`)**: personalización de Modo Oscuro/Claro, 4 colores de acento (*NVIDIA Emerald*, *Blackwell Cyan*, *Amber Forge*, *Violet Pulse*), densidad de interfaz (*Confortable* / *Compacta*), barra lateral colapsable, credenciales de API en vivo y exportación/importación de Workspace (`.json`).
  - **Creador interactivo de ejemplos en DataSets (`/datasets`)** y **curva de Loss en vivo** durante el entrenamiento en el Wizard (`/modelos/crear`).
  - Fix en `useRuntime.ts`: evita que `useStandaloneRuntime` inicie un segundo loop de polling cuando el componente ya está dentro de `RuntimeProvider`.
- **engine-api & llama-runtime & llama-trainer**:
  - `llama-runtime/entrypoint.sh`: soporte completo para `LLAMA_FLASH_ATTN=on|off|auto|1|0`, `LLAMA_GPU_LAYERS`, `LLAMA_BATCH`, `LLAMA_UBATCH`, `LLAMA_JINJA`, `LLAMA_ROPE_FREQ_BASE`, `LLAMA_ROPE_FREQ_SCALE`, `LLAMA_REASONING_FORMAT` y `LLAMA_LORA`.
  - `engine-api`: persistencia de presets por modelo en `/models/presets.json` (`GET /api/models/presets`, `PUT /api/models/:id/preset`), borrado de modelos (`DELETE /api/models/:id`), proxy `POST /api/datasets/:id/append`, detección de `orphanMmprojs` y caché con TTL en `StatusService.getGpu()`.
  - `llama-trainer`: inyección real de `systemPrompt` en `format_chat`, registro de `lossHistory` por step, `merge_and_unload()` automático para exportar adaptadores LoRA/QLoRA a GGUF y nuevo endpoint `POST /api/datasets/<id>/append`.
- **engine-ui**: Rediseño integral UI/UX (v0.4.0):
  - Nuevo **Playground Multimodal** (`/playground`) con chat streaming SSE (`/v1/chat/completions`), soporte de imágenes en base64 para modelos con visión (`mmproj`), control de parámetros (`Temperature`, `Top-P`, `Max Tokens`, `System Prompt`), métricas `tok/s` en vivo y exportación a `.jsonl`.
  - **RuntimeContext compartido**: elimina el polling duplicado entre `Layout` y vistas hijas, conserva el historial de telemetría (`tok/s`, prompt `tok/s`, uso y temperatura GPU) durante toda la sesión y agrega selector de frecuencia (`3s`, `5s`, `10s`, pausa).
  - **Command Palette (`Ctrl+K`)**: búsqueda rápida de pantallas, cambio de modelo GGUF activo y acciones del runtime.
  - **Sistema de diseño**: soporte para Modo Oscuro y Modo Claro (`ThemeProvider`), sistema de notificaciones `ToastProvider`, diálogos de confirmación (`ConfirmDialog`), `ErrorBoundary` e iconografía vectorial SVG (`Icons.tsx`).
  - **Mejoras por pantalla**: Hero banner y mini-chart en Dashboard; filtros, ordenamiento, presets de contexto, panel de parámetros avanzados de KV Cache/Flash Attention, barra de progreso de descarga GGUF en tiempo real y estimador de VRAM en Modelos; visor de logs con búsqueda, filtro de severidad, copia y descarga `.log` en Runtime; doble gráfica y tabla de slots en Telemetría; generador de snippets API (`cURL`, `Python`, `TypeScript`, `opencode`, `Hermes`) y buscador en Ayuda.
  - **nginx.conf**: soporte de proxy reverso `/v1/` sin buffering (`proxy_buffering off`) para streaming SSE desde el mismo origen.
  - Corrección de todos los errores de Biome/accesibilidad, de la doble invocación de quantización en `ModelWizard` y soporte de polling de jobs de quantización (`GET /api/quantize/jobs/:jobId`).
- **engine-api**: Mejoras integrales de validación, runtime y proxy al trainer:
  - Nuevos esquemas **Zod** (`src/schemas.ts`) para validar todas las entradas (`reload`, `deploy`, `hf/download`, `train/start`, `quantize`) y prevenir Path Traversal.
  - `RuntimeManager.reload()` y `POST /api/models/reload` soportan parámetros avanzados de inferencia (`cacheTypeK`, `cacheTypeV`, `parallel`, `threads`, `flashAttn`, `chatTemplate`, `gpuLayers`, `batchSize`, `ubatchSize`).
  - Nuevo proxy `POST /api/datasets` (subida multipart `.jsonl` hacia `llama-trainer`) y `GET /api/quantize/jobs/:jobId`.
  - `POST /api/models/deploy` ahora recarga automáticamente `llama-runtime` cuando `activate: true`.
  - `HuggingFaceHub` soporta descargas asíncronas en segundo plano con seguimiento de progreso (`GET /api/hf/downloads`, `GET /api/hf/downloads/:jobId`) y escritura atómica vía archivo temporal `.part`.
- **llama-trainer**: Seguridad, ciclo de vida de jobs y soporte completo de `llama-imatrix`:
  - Sanitización estricta de nombres de archivos e identificadores (`sanitize_identifier`, `safe_join` con `werkzeug.utils.secure_filename`) en todos los endpoints de datasets, entrenamiento, quantización y deploy.
  - Corrección de estado final en `run_training`: asigna `status = "completed"`, `progress = 100` y `epoch = epochs` al concluir `trainer.train()`.
  - `llama-trainer/Dockerfile` ahora compila el target `llama-imatrix` junto con `llama-quantize`, y `server.py` genera un corpus de calibración por defecto si `/workspace/calibration.txt` no existe.
- **docs**: Nuevo reporte de auditoría y mejoras integrales en [`docs/updates/ANALISIS_Y_REPORTE_MEJORAS.md`](./docs/updates/ANALISIS_Y_REPORTE_MEJORAS.md).
- **docs**: Nueva guía [`docs/INTEGRACION-HERMES.md`](./docs/INTEGRACION-HERMES.md) para usar el motor como proveedor local de **Hermes Agent** (bloque `providers:` + `model_aliases:` en `config.yaml`), con selección vía `--provider`/`/model`, notas de thinking/tool-calling y troubleshooting.
- **engine-agent** (nuevo servicio de agente autónomo):
  - Bucle de razonamiento interactivo y ejecución autónoma de herramientas (`src/agent/loop.ts`).
  - Base de datos SQLite integrada con historial de sesiones y memorias persistentes (`src/sessions/`, `src/modules/memories/`).
  - Registro de herramientas built-in (`bash`, `file-ops`, `search`, `memory`) con límites de salida y filtrado de directorios ignorados.
  - Servidor WebSocket para streaming en tiempo real y API REST Express para gestión de sesiones, memorias y herramientas.
  - Subcutánea integración con Servidores MCP (Model Context Protocol) mediante JSON-RPC sobre stdio y REST `/api/mcp/servers`.
  - Normalización de baseURL `/v1` y manejo de presupuesto de contexto token limit.
- **engine-ui-agent** (nueva interfaz moderna de Agent Studio):
  - Diseño Obsidian Dark UI/UX inspirado en Claude, Gemini, ChatGPT y DeepSeek.
  - Sidebar colapsable con sincronización reactiva de sesiones (`SessionsProvider`), búsqueda en historial y accesos directos.
  - Menú desplegable interactivo para selección de modelos de IA con badges por proveedor.
  - Extracción y adjunto de archivos de código y texto (`.md`, `.txt`, `.json`, etc.) directamente al prompt del agente.
  - Modal de gestión de Servidores MCP para conectar, desconectar y registrar herramientas externas dinámicas.
  - Acordeón de proceso de razonamiento / pensamiento y tarjetas de ejecución de herramientas con estados en tiempo real.
- **engine-ui**: Wizard de personalización de modelos paso a paso (nueva ruta `/modelos/crear`):
  - Selector de flujo: Crear modelo, Mejorar modelo, Optimizar rendimiento.
  - Paso a paso guiado con stepper visual y navegación.
  - Selección de modelo base (HuggingFace o locales).
  - Upload y validación de datasets JSONL (ShareGPT, OpenAI, Alpaca).
  - Configuración de entrenamiento (QLoRA, LoRA, Full FT) con parámetros ajustables.
  - Monitoreo de entrenamiento con loss curves y logs en tiempo real.
  - Quantización interactiva (Q3_K_M a Q8_0) con estimación de tamaño.
  - Deploy one-click a /models con activación automática.
- **llama-trainer** (nuevo servicio Docker):
  - API Flask para gestión de datasets, entrenamiento, conversión HF→GGUF y quantización.
  - Integración con LLaMA-Factory para fine-tuning.
  - Herramientas de llama.cpp (llama-quantize, llama-imatrix, convert_hf_to_gguf.py).
  - Endpoints: `/api/datasets`, `/api/train`, `/api/quantize`, `/api/models/deploy`.
- **engine-api**: Nuevos endpoints proxy al trainer:
  - `GET /api/datasets`, `DELETE /api/datasets/:id`, `GET /api/datasets/:id/validate`
  - `POST /api/train/start`, `GET /api/train/jobs`, `GET /api/train/jobs/:jobId`
  - `POST /api/quantize`, `GET /api/quantize/methods`
  - `POST /api/models/deploy`

- **engine-ui**: Pantalla DataSets (nueva ruta `/datasets`) con biblioteca de datasets de entrenamiento:
  - Subida de archivos `.jsonl`/`.json` al trainer (formatos ShareGPT, OpenAI y Alpaca) con validación, previsualización, borrado y estado por dataset.
  - Botones "Crear modelo" / "Mejorar modelo" que abren el asistente con el dataset preseleccionado (`/modelos/crear?flow=…&datasetId=…`).
  - El paso Dataset del asistente ahora elige de la biblioteca o sube un archivo nuevo; antes solo se parseaba en el navegador y el archivo nunca se persistía en el trainer.
- **engine-api**: Nuevo proxy `GET /api/datasets/:id/preview?limit=N` hacia el trainer para previsualizar datasets guardados.
- **llama-trainer**: Nuevo endpoint `GET /api/datasets/<id>/preview` que devuelve hasta N turnos normalizados (ShareGPT/OpenAI/Alpaca).

### Fixed
- **llama-runtime**: crash-loop por `--flash-attn` sin valor. La versión actual de llama-server exige
  `--flash-attn on|off|auto`. `entrypoint.sh` ahora pasa `--flash-attn on`.
- **llama-runtime**: `qwen3.5-4b.gguf` montado truncado (345 MB, incompleto). Re-descargado Q4_K_M
  (2.7 GB) + `mmproj` (visión). Documentado en `docs/INSTALL.md` § modelos.
- **engine-api**: proxy `/v1` devolvía 400/500 o se colgaba. `express.json()` consumía el stream del
  request antes de reenviarlo; el proxy re-emite ahora el body desde `req.body` con `content-length`
  explícito (llama-server no parsea `chunked`). Ver `docs/ARQUITECTURA.md` § proxy.

## [0.1.0] - 2026-08-09

### Added
- Scaffold monorepo con Docker Compose: `llama-runtime`, `engine-api`, `engine-ui`.
- **llama-runtime**: Dockerfile con build `llama-server` desde fuente, CUDA 12.8 + `CMAKE_CUDA_ARCHITECTURES=120` (Blackwell) + flash-attention + `mmproj`. Entrypoint que arma los flags (`-ngl`, `--flash-attn`, chat template).
- **engine-api** (Express + TS + Biome + Zod):
  - Auth por API key (`x-api-key`/`Bearer`), middleware `auth.ts`.
  - Proxy `/v1` OpenAI-compatible con streaming SSE.
  - `/api/health` y `/api/status` (telemetría GPU vía nvidia-smi + slots + modelo + registro).
  - `/api/models/reload` y `/api/runtime/restart` (Dockerode).
  - Registry de GGUFs montados con detección de visión (`mmproj`).
  - Rate limiting por ventana, Helmet, CORS.
- **engine-ui**: SPA React 19/Vite con dashboard glassmorphism, poll de status cada 3s: modelo, throughput tok/s, GPU (VRAM/util/temp/potencia), slots y registro de modelos.
- Dockerfile de UI (Vite build + nginx con proxy `/api` a engine-api).
- Docs: `ARQUITECTURA`, `INSTALL`, `INTEGRACION-OPENCODE`; `models/README`; raíz `README`.