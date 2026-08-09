# Instalación — Llama Engine

Guía paso a paso para levantar los tres servicios con GPU.

## 1. Requisitos de hardware/software

- Docker + Docker Compose v2.
- **NVIDIA GPU** con driver **CUDA 12.8+** (idealmente RTX 50xx / Blackwell — usá un SM_CUDA_ARCHITECTURES de tu gama).
- [`nvidia-container-toolkit`](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) instalado:
  ```bash
  sudo nvidia-ctk runtime configure --runtime=docker   # Linux
  sudo systemctl restart docker
  ```
- Node 20+ (solo desarrollo del wrapper/UI, no se requiere en producción).

## 2. Clonar y configurar

```bash
git clone <repo> llama-engine
cd llama-engine
cp .env.example .env
```

Ajustá en `.env`:
- `API_KEY` — clave para autenticar el portal de gestión.
- `SM_CUDA_ARCHITECTURES` — arquitectura de tu GPU (ver [tabla](#tabla-de-arquitecturas)).
- `LLAMA_MODEL` / `MODELS` — modelo por defecto y qué montar.

## 3. Instalar los modelos GGUF

```bash
# Qwen 3.5 4B (multimodal, Apache-2.0, recomendado)
mkdir -p models/qwen35 webui/models/qwen35
# ...descargar <id>.gguf (+ mmproj-<id>.gguf para visión) siguiendo el fabricante
```

La convención: `models/<id>.gguf` y opcional `models/mmproj-<id>.gguf`. El registro los
detecta automáticamente (`vision: true` si existe el mmproj). Ver `docs/INSTALL.md` del repo
matriz o `models/README.md` para las rutas exactas de descarga.

### Tabla de arquitecturas

| GPU | `SM_CUDA_ARCHITECTURES` |
|-----|--------------------------|
| RTX 5060/5060 Ti 🟢 | `120` |
| RTX 5070/5090 | `120` |
| RTX 4090 | `120` o `89` (adatado) |
| RTX 4060 ti | `120` |
| RTX 3080 | `86` |
| Otras | consultá la antología de arquitectura sm de tu GPU |

> Por defecto, el Dockerfile usa `120` (RTX 50xx/Blackwell). Si tu GPU no es Blackwell,
> cambiá `SM_CUDA_ARCHITECTURES` en `.env`.

## 4. Levantar

```bash
docker compose build        # compila llama-runtime (lento la primera vez, CUDA)
docker compose up -d        # levanta runtime + api + ui
docker compose logs -f engine-api
```

### Estado
- API: http://localhost:3050/api/health
- UI telemetría: http://localhost:3051
- Runtime (interno): http://llama-runtime:8080

## 5. Comprobar

```bash
curl http://localhost:3050/api/health
# {"apiUptimeMs":..,"runtimeRunning":true,"runtimeHealthy":true,"loadedModel":"..."}

# Telemetría GPU + slots
curl -H "x-api-key: $API_KEY" http://localhost:3050/api/status

# Chat streaming
curl -X POST http://localhost:3050/v1/chat/completions \
  -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"qwen3.5-4b","messages":[{"role":"user","content":"Hola"}]}'
```

## 6. Problemas comunes

| Síntoma | Solución |
|---------|----------|
| `Could not locate cudart` | Rebuild del runtime con la arquitectura correcta. |
| GPU no detectada en el contenedor | Verificá `docker run --gpus all` y `nvidia-container-toolkit`. |
| `Invalid GRP`/kernels en la carga | `SM_CUDA_ARCHITECTURES` no incluye tu arquitectura. |
| Sin `--flash-attention` | Build de CUDA architecture necesaria + flag enllama-run. |
| `mmproj` no se ve | Asegurate el `<id>.gguf` + el `mmproj-<id>.gguf` y reiniciá la API. |
| Slow first prompt | Esperá a que el modelo se cargue (VRAM + warmup). |

## 7. Actualizar a nueva versión de llama.cpp

Reconstruí el runtime con los últimos commits de llama.cpp:

```bash
docker compose build llama-runtime --no-cache
```

## 8. Confirmación de compilación del runtime

El Dockerfile compila con:

- `GGML_CUDA=ON`
- `CMAKE_CUDA_ARCHITECTURES=$SM_CUDA_ARCHITECTURES` (default `120`)
- `GGML_CUDA_FA_ALL_QUANTS=ON`
- `GGML_CUDA_FLASH_ATTN=ON`
- `CMAKE_BUILD_TYPE=Release`

Verifica al arranque: `llama-server --version` debe mostrar compilación con CUDA + sm_120/Blackwell.