# Arquitectura — Llama Engine

## Visión

Motor local y reusable de LLMs sobre **llama.cpp**, con tres servicios Docker que separan el runtime de inferencia (GPU) del wrapper de API y de la UI de telemetría.

```
                         ┌─────────────────────────────┐
                         │          engine-ui          │  :3051
                         │   SPA React/Vite (nginx)    │
                         └──────────────┬──────────────┘
                                        │ GET /api/status (poll 3s)
                         ┌──────────────▼──────────────┐
                         │          engine-api         │  :3050
                         │  Express + TS + Zod         │
                         │  ┌─────────┐ ┌────────────┐ │
                         │  │ proxy   │ │ status     │ │  → nvidia-smi (vía docker exec)
                         │  │  /v1    │ │ (GPU/slots)│ │
                         │  └─────────┘ └────────────┘ │
                         │  registry GGUFs · runtime   │  → Dockerode (docker.sock)
                         └──────┬──────────────┬───────┘
                                │ HTTP /v1      │ docker exec (GPU)
                         ┌──────▼──────────────▼───────┐
                         │         llama-runtime       │  :8080 (interna)
                         │   llama-server (llama.cpp)  │
                         │   CUDA 12.8 + sm_120        │
                         │   + flash-attn + mmproj      │
                         └──────────────┬──────────────┘
                                        │ monta ./models (GGUF)
                                 ┌──────▼──────┐
                                 │    models   │  (bind mount readonly)
                                 └─────────────┘
```

## Flujos

### Chat / inferencia
```
Consumer → engine-api POST /v1/chat/completions (OpenAI-compatible, auth API_KEY)
  → proxy → llama-server /v1/chat/completions (streaming SSE, soporta image_url)
  ← respuesta streaming
```

### Telemetría
```
engine-ui → GET /api/status (con API_KEY)
  → StatusService
    ├─ GPU: runtime.exec("nvidia-smi ...") → VRAM, uso, temp, potencia
    ├─ slots: GET runtime /slots → throughput tok/s (prompt + generación)
    ├─ loadedModel: GET runtime /props → modelo cargado
    └─ models: registry.list() → GGUFs montados en ./models
```

### Gestión del runtime
```
POST /api/models/reload {modelId, ctxSize?} → Dockerode recrea el contenedor
  con LLAMA_MODEL actualizado y lo reinicia (entrypoint compone los flags).
```

## Capas (engine-api)

| Módulo | Rol |
|--------|-----|
| `env.ts` / `config.ts` | Validación de entorno con Zod + AppConfig tipado. |
| `runtime/manager.ts` | Dockerode: start/stop/reload/restart/exec del contenedor runtime. |
| `models/registry.ts` | Scan de `MODELS_DIR` → registro de GGUFs (con detección de visión). |
| `status/index.ts` | Telemetría agregada: GPU + slots + modelo + registro. |
| `proxy/v1.ts` | Proxy transparente OpenAI `/v1` con streaming al runtime. |
| `middleware/auth.ts` | Auth por API key (`x-api-key` o `Bearer`). |

## Seguridad

- API key obligatoria en `engine-api` (management + proxy `/v1`).
- Rate limiting (por ventana configurable).
- Helmet + CORS abierto para consumers locales/red.
- `llama-runtime` expone su puerto 8080 solo hacia la red interna (`engine-network`); en el host se publica en `127.0.0.1`.

## Decisiones clave

- **llama.cpp en vez de Ollama**: capa más baja, control total de flags (`-ngl`, `--flash-attn`, GGUF a medida). Ollama es un wrapper de llama.cpp.
- **Build desde fuente (CUDA 12.8 + sm_120)**: la imagen oficial se compila con CUDA 12.4, sin kernels para RTX 50xx (Blackwell).
- **Dos contenedores (runtime + wrapper)**: separa GPU (inferencia) de la capa de gestión/API, espejando el patrón backend↔motor de LaLlamaOllama pero sobre llama.cpp.
- **Registro de modelos por GGUFs montados**: sin gestor de descargas; la convención `<id>.gguf` + `mmproj-<id>.gguf` define el catálogo.

## Roadmap

- **Voz (v1 NO incluida)**: pipeline separado ASR (Whisper) → texto → LLM → TTS. Entrada de audio directa a llama-server sigue siendo experimental.
- Descarga de GGUFs vía API (Hugging Face) desde el wrapper.

## Registro en el brain

- Vault: `Proyectos/llama-engine/llama-engine.md` (ficha) + `Decisiones/ADR-001…006` + `Worklog/llama-engine/`.
- Registro completo de decisiones y acciones en el brain (OpenBrainCode), no en el repo.