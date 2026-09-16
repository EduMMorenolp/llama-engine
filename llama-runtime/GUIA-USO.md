# Guía de uso — llama-runtime

`llama-runtime` es el contenedor de inferencia del proyecto: corre **`llama-server`** (de llama.cpp)
compilado desde fuente con CUDA 12.8 + soporte Blackwell (sm_120), flash-attention y multimodal
(vía `mmproj`). Expone una API OpenAI-compatible por HTTP.

Este documento cubre **qué variables y flags configura**, **cómo operarlo con Docker** y los
**endpoints** que expone. Para el flujo completo del motor (UI, API, modelos) ver
[`docs/ARQUITECTURA.md`](../docs/ARQUITECTURA.md) y [`docs/INSTALL.md`](../docs/INSTALL.md).

---

## 1. Contenedor por defecto (docker-compose)

| Campo | Valor |
|-------|-------|
| Imagen | `llama-engine-llama-runtime` |
| Puerto interno | `8080` |
| Puerto host | `127.0.0.1:8080` |
| Modelo | `/models/<id>.gguf` (bind mount readonly de `./models`) |
| GPU | `runtime: nvidia` + `NVIDIA_VISIBLE_DEVICES=all` |

Levantar solo el runtime (sin depender de API/UI):

```bash
docker compose up -d llama-runtime
docker compose logs -f llama-runtime
```

---

## 2. Variables de entorno

El entrypoint (`entrypoint.sh`) compone los flags de `llama-server` a partir de estas variables:

| Variable | Default | Flag resultante | Descripción |
|----------|---------|-----------------|-------------|
| `LLAMA_MODEL` | *(requerida)* | `--model /models/<id>.gguf` | Id del modelo GGUF a cargar (por ejemplo `qwen3.5-4b`). |
| `LLAMA_CTX_SIZE` | `32768` | `--ctx-size <n>` | Contexto (tokens). |
| `LLAMA_NGPU` | `-1` | `--n-gpu-layers <n>` | Capas descargadas a GPU (`999` = todo, `-1` = auto). |
| `LLAMA_FLASH_ATTN` | `1` | `--flash-attn on` | Flash attention. `0` lo desactiva. |
| `LLAMA_CHAT_TEMPLATE` | `auto` | `--chat-template <t>|auto` | Template de chat; `auto` no agrega el flag. |
| `LLAMA_MMPROJ` | `auto` | `--mmproj <archivo>` | Proyector multimodal; `auto` usa `mmproj-<id>.gguf` si existe. |

> **Nota importante:** `--flash-attn` exige un valor explícito (`on`). Pasarlo desnudo rompe el parseo
> de `llama-server` y el contenedor entra en crash-loop. Ver `docs/ARQUITECTURA.md` y
> `Brain/Errores/llama-server-flash-attn-flag` en el vault OpenBrainCode.

### Variables GPU/entorno que Docker inyecta

- `NVIDIA_VISIBLE_DEVICES=all` y `NVIDIA_DRIVER_CAPABILITIES=compute,utility` (runtime nvidia).
- `LD_LIBRARY_PATH=/usr/local/lib` (librerías `ggml`/`llama` en la imagen).

---

## 3. Comandos útiles con Docker

Todos arrancan desde la raíz del repo (donde está `docker-compose.yml`).

### Ver estado

```bash
docker compose ps llama-runtime
docker ps --filter "name=llama-runtime"
```

### Ver logs (flags compuestos + carga del modelo)

```bash
docker compose logs llama-runtime
docker compose logs -f --tail 50 llama-runtime
```

El primer log útil es `==> llama-server flags: ...` (los flags que el entrypoint compone). Después
buscá `model loaded` y `listening on http://0.0.0.0:8080`.

### Reiniciar (recarga el modelo desde `/models`)

```bash
docker compose restart llama-runtime
```

### Rebuild al cambiar el entrypoint o el Dockerfile

```bash
docker compose build llama-runtime
docker compose up -d llama-runtime
```

### Inspeccionar la GPU dentro del contenedor (nvidia-smi)

```bash
docker compose exec llama-runtime nvidia-smi
```

### Shell interactivo hacia el runtime

```bash
docker compose exec llama-runtime bash
```

### Ver la versión de llama-server compilada

```bash
docker compose exec llama-runtime llama-server --version
```

Debe mostrar compilación con CUDA y `sm_120` (Blackwell).

---

## 4. Endpoints HTTP (OpenAI-compatible)

`llama-server` expone la API OpenAI-compatible en el puerto interno `8080`, y en el host en
`http://127.0.0.1:8080`.

| Endpoint | Método | Uso |
|----------|--------|-----|
| `/v1/chat/completions` | POST | Chat streaming (OpenAI-compatible). |
| `/v1/models` | GET | Lista de modelos disponibles. |
| `/health` | GET | Estado de salud (debe devolver `{"status":"ok"}`). |
| `/slots` | GET | Slots de inferencia y throughput (tok/s). |
| `/props` | GET | Propiedades del servidor/modelo. |
| `/models` | GET | Lista de modelos cargados internamente. |
| `/metrics` | GET | **Deshabilitado** (501): requiere build con soporte Prometheus. |

> **Endpoints no compilados en esta build** (devuelven 404): `/v1/embeddings`, `/completion`,
> `/embedding`, `/rerank`, `/tokenize`, `/detokenize`, `/infill`. Para habilitar embeddings/rerank
> habría que rebuildear `llama-server` desde fuente con los flags correspondientes.

### Probar el chat directo (sin pasar por engine-api)

```bash
curl -s http://127.0.0.1:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3.5-4b","messages":[{"role":"user","content":"Hola, decime OK"}]}'
```

### Probar salud

```bash
curl -s http://127.0.0.1:8080/health
```

> Para producción se recomienda usar **engine-api** sobre `:3050` (auth por API key, proxy, gestión),
> no el puerto directo del runtime.

---

## 5. Modelos y visión

Convención de montaje en `./models`:

```
models/
├── qwen3.5-4b.gguf          # modelo principal → LLAMA_MODEL=qwen3.5-4b
└── mmproj-qwen3.5-4b.gguf   # proyector multimodal (opcional) → vision
```

- Si `mmproj-<id>.gguf` existe, `LLAMA_MMPROJ=auto` agrega `--mmproj` automáticamente.
- Un GGUF **truncado/incompleto** rompe la carga con
  `tensor ... data is not within the file bounds`. Verificá el tamaño real (un 4B Q4_K_M ≈ 2.7 GB).
  Ver `Brain/Errores/gguf-truncado-model-corrupted` en el vault.

---

## 6. Cambiar entre modelos

El motor carga **un modelo a la vez**. Existen dos vías para cambiar con qué GGUF correr.

### Vía la web de gestión (recomendada)

En `engine-ui` (pantalla **Modelos**): seleccioná el GGUF del desplegable, ajustá el contexto
(opcional) y usá el botón **Recargar**. La UI llama a `POST /api/models/reload` y refresca el estado
automáticamente.

### Vía API (`engine-api`, puerto `3050`)

```bash
# 1. Ver qué modelos están registrados (requiere tu API_KEY del .env)
curl -H "x-api-key: TU_API_KEY" http://localhost:3050/api/models

# 2. Cambiar de modelo (recarga el contenedor con LLAMA_MODEL actualizado)
curl -X POST http://localhost:3050/api/models/reload \
  -H "x-api-key: TU_API_KEY" -H "Content-Type: application/json" \
  -d '{"modelId":"qwen3.5-4b"}'          # solo cambio de modelo

# opcional: ajustar el contexto en el mismo reload
curl -X POST http://localhost:3050/api/models/reload \
  -H "x-api-key: TU_API_KEY" -H "Content-Type: application/json" \
  -d '{"modelId":"qwen3.5-4b","ctxSize":16384}'
```

> Requisito: el GGUF debe estar montado en `./models` (`<id>.gguf` y, si tiene visión,
> `mmproj-<id>.gguf`). `POST /api/runtime/restart`, `stop` y `start` también están disponibles.

### Vía env + Docker (cambio permanente al levantar)

```bash
# editar .env → LLAMA_MODEL=<id>
docker compose up -d llama-runtime   # recrea el contenedor tomando el nuevo env
```

---

## 7. Troubleshooting rápido

| Síntoma | Causa / acción |
|---------|----------------|
| `Restarting (1)` | Crash-loop: revisá el log; típicamente flag inválido o modelo faltante/truncado. |
| `unknown value for --flash-attn` | `--flash-attn` sin valor. El entrypoint ya usa `--flash-attn on`. |
| `No existe el modelo ...` | Falta `<id>.gguf` en `./models` o `LLAMA_MODEL` no coincide. |
| `data is not within the file bounds` | GGUF truncado; re-descargá el archivo completo. |
| GPU no aparece | Verificá `runtime: nvidia` y `nvidia-container-toolkit`; luego `docker compose exec llama-runtime nvidia-smi`. |
| Slow first prompt | Es el warmup del modelo (carga a VRAM); con GGUF cuantizado es más rápido. |

---

## 8. Relación con los otros servicios

- `engine-api` (puerto `3050`) llama a `http://llama-runtime:8080` por la red interna `engine-network`.
- `engine-ui` (puerto `3051`) consume `engine-api`, no llama al runtime directo.
- Para integrar el motor como proveedor de opencode, ver [`docs/INTEGRACION-OPENCODE.md`](../docs/INTEGRACION-OPENCODE.md).