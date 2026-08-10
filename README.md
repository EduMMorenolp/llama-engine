# Llama Engine

> Motor local de LLMs sobre **llama.cpp** (llama-server), con wrapper API **OpenAI-compatible**, gestión vía Docker y **web de telemetría** en tiempo real.

## Servicios

| Servicio | Contenedor | Puerto | Rol |
|----------|-----------|--------|-----|
| **llama-runtime** | `llama-runtime` | 8090 (host) / 8080 (interna) | llama-server compilado CUDA + Blackwell (sm_120). Ejecuta los modelos GGUF. |
| **engine-api** | `engine-api` | 3050 | Wrapper Express/TS: proxy `/v1`, telemetría GPU, registro de modelos, restart/reload. |
| **engine-ui** | `engine-ui` | 3051 | SPA React/Vite: dashboard glassmorphism de telemetría. |

## Stack

- **Runtime**: llama.cpp (`llama-server`) — build desde fuente con CUDA 12.8 + `CMAKE_CUDA_ARCHITECTURES=120` (RTX 50xx/Blackwell) + flash-attention.
- **API**: Node 20, Express 4, TypeScript, Biome, Zod, Dockerode.
- **UI**: React 19, Vite 6, TypeScript.
- **Infra**: Docker Compose, GPU vía `nvidia-container-toolkit`.

## Modelos soportados (GGUF + visión)

Se montan en `./models/` con la convención `<id>.gguf` (+ `mmproj-<id>.gguf` para visión):

- `qwen3.5-4b` — **Qwen 3.5 4B**, Apache-2.0, multimodal (texto+imagen) nativa.
- `gemma4-4b` — **Gemma 4 4B (E4B)**, multimodal (texto+imagen), requiere `--chat-template gemma`.

> El registro detecta los GGUFs montados automáticamente. `vision: true` si existe el `mmproj`. Ver [`docs/INSTALL.md`](./docs/INSTALL.md) para descargarlos.

## Uso rápido

```bash
cp .env.example .env          # ajustá API key / modelos
docker compose up -d --build  # levanta runtime + api + ui

# Salud
curl http://localhost:3050/api/health

# Telemetría
curl -H "x-api-key: $API_KEY" http://localhost:3050/api/status

# Chat streaming (OpenAI-compatible)
curl -X POST http://localhost:3050/v1/chat/completions \
  -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"qwen3.5-4b","messages":[{"role":"user","content":"Hola"}]}'
```

Web de telemetría: http://localhost:3051

La web incluye un botón **i** (información) con specs del sistema en vivo, changelog de versiones y
manual de uso.

## Integración con opencode

Este motor es compatible con opencode vía proveedor OpenAI-compatible. Ver [`docs/INTEGRACION-OPENCODE.md`](./docs/INTEGRACION-OPENCODE.md).

## Estructura

```
llama-engine/
├── docker-compose.yml
├── llama-runtime/          # Dockerfile tu build CUDA/Blackwell + entrypoint
├── engine-api/             # wrapper API (src/{main,config,env,runtime,models,proxy,status,middleware})
├── engine-ui/              # SPA de telemetría
├── models/                 # GGUFs montados (gitignored)
└── docs/                   # ARQUITECTURA, INSTALL, INTEGRACION-OPENCODE
```

## Requisitos

- Docker + Docker Compose.
- NVIDIA GPU con driver CUDA 12.8+ (recomendado RTX 50xx) y `nvidia-container-toolkit`.
- Node 20 (solo para desarrollo del wrapper/UI).

## Licencia

MIT © 2026 — Llama Engine.