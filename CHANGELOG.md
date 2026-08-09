# Changelog

Todas las entradas notables del proyecto.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y el proyecto se adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Seccion para cambios en desarrollo que no se publicaron aún.

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