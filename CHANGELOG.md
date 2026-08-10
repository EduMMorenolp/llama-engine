# Changelog

Todas las entradas notables del proyecto.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y el proyecto se adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **engine-ui**: página de información del sistema (botón **i** en la topbar) con:
  - Panel de specs en vivo: versión, uptime API, modelo cargado, modelos registrados, GPU y VRAM.
  - Changelog de versiones (1/3 del ancho) + manual de uso (2/3). Modal accesible (Escape, ×, backdrop).
  - Datos de contenido en `src/info.ts`; modal en `src/InfoModal.tsx`.

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