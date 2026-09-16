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

### Added
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