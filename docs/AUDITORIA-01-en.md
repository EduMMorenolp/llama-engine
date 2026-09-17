# Auditoría de Rendimiento — Llama Engine

> Fecha: 2026-09-17
> Propósito: Documentar el estado actual del sistema como baseline para futuras optimizaciones.

---

## 1. Hardware

| Componente | Detalle |
|------------|---------|
| GPU | NVIDIA GeForce RTX 5050 (Blackwell, sm_120) |
| VRAM | 8,151 MiB GDDR6 |
| Memory Bandwidth | 320 GB/s |
| CUDA Cores | 2,560 |
| Tensor Cores | 421 TOPS (5ta gen, Blackwell) |
| Driver | 610.88 |
| CUDA Toolkit | 12.8.0 |
| CPU | Intel Core i7-3770 @ 3.40GHz (Ivy Bridge, 2012) |
| Cores / Threads | 4 / 8 |
| Instruction Sets | AVX (sin AVX2) |
| RAM | 16 GB DDR3 |
| Disco | No determinado (los modelos se montan vía bind mount) |

### Limitaciones clave del hardware
- **CPU antigua (2012)**: Cualquier offload a CPU será extremadamente lento. Los modelos deben caber 100% en GPU para ser útiles.
- **8 GB VRAM**: Límite estricto para modelos cuantizados. Modelos ≥13B requieren offload parcial.
- **Sin AVX2**: Instrucciones vectoriales limitadas para operaciones CPU-side.

---

## 2. Stack de software

| Componente | Versión / Detalle |
|------------|-------------------|
| llama.cpp | Build desde fuente (`--depth 1`, HEAD del momento del build) |
| Base image (build) | `nvidia/cuda:12.8.0-cudnn-devel-ubuntu22.04` |
| Base image (runtime) | `nvidia/cuda:12.8.0-runtime-ubuntu22.04` |
| Docker Compose | v2 |
| nvidia-container-toolkit | Requerido |
| engine-api | Node 20, Express 4, TypeScript |
| engine-ui | React 19, Vite 6 |

### Flags de compilación del runtime

```
GGML_CUDA=ON
CMAKE_CUDA_ARCHITECTURES=120          # RTX 50xx / Blackwell
GGML_CUDA_FA=ON                       # Flash Attention
GGML_CUDA_FA_ALL_QUANTS=ON            # FA para todos los quantizations
DLLAMA_CURL=ON                        # Descarga de modelos vía curl
CMAKE_BUILD_TYPE=Release
```

**Nota**: No hay versión de llama.cpp fija. El build usa HEAD del momento de `docker compose build`. Reconstrucción con `--no-cache` actualiza a la última versión.

---

## 3. Modelos disponibles

### Modelos en disco (`./models/`)

| Modelo | Archivo | Tamaño | Quantización | Parámetros | Visión | mmproj |
|--------|---------|--------|--------------|------------|--------|--------|
| **Qwen 3.5 9B** | `qwen3.5-9b.gguf` | 5.0 GB | Q4_K_M | 8.95B | No | — |
| **Gemma 4 E4B** | `gemma-4-e4b.gguf` | 4.9 GB | Q4_K_M | 4.5B effective | Sí | `mmproj-gemma-4-e4b.gguf` (946 MB) |
| **Mistral Small 7B** | `mistral-small-7b.gguf` | 4.1 GB | Q4_K_M | ~7B | No | — |
| **Qwen 3.5 4B** | `qwen3.5-4b.gguf` | 2.6 GB | Q4_K_M | 4B | Sí | `mmproj-qwen3.5-4b.gguf` (642 MB) |
| **Phi-4 Mini** | `phi-4-mini.gguf` | 2.4 GB | Q4_K_M | 3.8B | No | — |

**Total en disco**: ~19 GB

### Modelos eliminados (previamente descargados, ya no están en disco)
- `gemma-4-12B-it-qat-UD-Q4_K_XL.gguf` (6.3 GB) — No cabe 100% en GPU, offload parcial con i7-3770 = ~5 tok/s
- `mtp-gemma-4-12B-it.gguf` (242 MB) — MTP drafter para la 12B
- `mmproj-BF16.gguf` (168 MB) — Proyector multimodal para la 12B

---

## 4. Configuración actual del runtime

### `.env` (archivo de configuración)

```env
# --- Puertos ---
ENGINE_API_PORT=3050
ENGINE_UI_PORT=3051
LLAMA_HOST_PORT=8080
TRAINER_PORT=8081
AGENT_PORT=3060
AGENT_UI_PORT=3061

# --- Seguridad ---
ENGINE_API_KEY=llama-engine-dev

# --- GPU ---
LLAMA_GPU_DEVICE=all

# --- Runtime llama.cpp ---
LLAMA_MODEL=qwen3.5-9b
LLAMA_MMPROJ=auto
LLAMA_NGPU=999
LLAMA_CTX_SIZE=32768
LLAMA_FLASH_ATTN=1
LLAMA_CHAT_TEMPLATE=auto
```

### `entrypoint.sh` — Parámetros expuestos

| Variable de entorno | Flag de llama-server | Default | Efecto |
|---------------------|---------------------|---------|--------|
| `LLAMA_MODEL` | `--model /models/<id>.gguf` | (requerido) | Selecciona el modelo a cargar |
| `LLAMA_CTX_SIZE` | `--ctx-size` | `32768` | Tamaño total del KV cache (compartido entre slots) |
| `LLAMA_NGPU` | `--n-gpu-layers` | `-1` (todas) | Número de capas offloadadas a GPU |
| `LLAMA_FLASH_ATTN` | `--flash-attn on` | `1` (activo) | Flash Attention para reducir uso de VRAM |
| `LLAMA_CHAT_TEMPLATE` | `--chat-template` | `auto` | Template de formateo de chat |
| `LLAMA_MMPROJ` | `--mmproj` | `auto` | Proyector multimodal (auto-detectado) |

### `docker-compose.yml` — Servicios activos

| Servicio | Container | Puerto | Estado |
|----------|-----------|--------|--------|
| llama-runtime | `llama-runtime` | 127.0.0.1:8080 | Up 22 min |
| engine-api | `engine-api` | 0.0.0.0:3050 | Up 29 hours |
| engine-ui | `engine-ui` | 0.0.0.0:3051 | Up 29 hours |
| llama-trainer | `llama-trainer` | 127.0.0.1:8081 | Up 29 hours |

---

## 5. Estado actual del modelo activo

### Modelo cargado: Qwen 3.5 9B

| Propiedad | Valor |
|-----------|-------|
| Modelo | `qwen3.5-9b` |
| Quantización | Q4_K_M |
| Tamaño en disco | 5.0 GB |
| Parámetros | 8,953,803,264 (8.95B) |
| Vocabulario | 248,320 tokens |
| Embedding dim | 4,096 |
| Contexto nativo entrenado | 262,144 tokens |
| Contexto configurado | 34,305 tokens |
| Slots | 4 (unified KV cache) |
| GPU Layers | 999 (todas en GPU) |
| Flash Attention | on |
| Chat Template | auto |

### VRAM

| Métrica | Valor |
|---------|-------|
| VRAM Total | 8,151 MiB |
| VRAM Usada | 6,586 MiB (81%) |
| VRAM Libre | 1,326 MiB (19%) |
| GPU Utilization | 2% (idle) |
| Temperatura | 35°C |
| Power Draw | 12.11 W |

### Flags de llama-server (reconstruidos desde logs)

```
--model /models/qwen3.5-9b.gguf
--host 0.0.0.0
--port 8080
--ctx-size 34305
--n-gpu-layers 999
--flash-attn on
--alias qwen3.5-9b
--no-webui
```

**Observación**: El `.env` dice `LLAMA_CTX_SIZE=32768` pero el container tiene `34305`. Esto indica que el container fue recreado con un valor diferente al actual del `.env` (posiblemente un reload manual con otro ctx size).

---

## 6. Métricas de rendimiento (benchmark real)

### Datos de los logs del container

| Request | Prompt Tokens | Prompt Speed (tok/s) | Generated Tokens | Generation Speed (tok/s) | Tiempo Total |
|---------|--------------|----------------------|------------------|--------------------------|--------------|
| #274 | 1,504 | **644.66** | 182 | **45.48** | 6.3s |
| #494 | 15 | 38.08 | 68 | **42.82** | 2.0s |
| #564 | 51 | **148.73** | 98 | **43.80** | 2.6s |
| #668 | 29 | 87.30 | 370 | **43.23** | 8.9s |
| #1042 | 11 | 22.07 | 99 | **39.33** | 3.0s |
| #1143 | 22 | 58.98 | 101 | **43.21** | 2.7s |

### Resumen de rendimiento

| Métrica | Promedio | Rango | Notas |
|---------|----------|-------|-------|
| **Prompt processing** | ~167 tok/s | 22 – 645 tok/s | Depende del tamaño del prompt |
| **Token generation** | **43.2 tok/s** | 39 – 45 tok/s | Consistente, buen rendimiento |
| **Slot usage** | Solo slot 3 | — | Los otros 3 slots están idle |
| **Graphs reused** | ~500 | 180 – 900 | Indica reutilización de grafos de compute |

### Comparación con benchmarks de referencia (RTX 5050 8GB)

| Modelo | Quant | Benchmark Ref. | Nuestro Resultado | Nota |
|--------|-------|----------------|-------------------|------|
| Qwen3.5-9B | Q4_K_M | 54-58 tok/s (locallm.in) | **43 tok/s** | Diferencia por 4 slots + 34K ctx |
| Qwen3.5-9B | Q4_K_M | 32-44 tok/s (inferencerig) | **43 tok/s** | En el rango esperado |
| Llama 3.1 8B | Q4_K_M | 30-45 tok/s (inferencerig) | — | Referencia similar |

**Análisis**: Nuestro resultado de 43 tok/s está dentro del rango esperado para RTX 5050. La diferencia con el benchmark de locallm.in (54-58 tok/s) se debe a que ellos usan `--parallel 1` y contextos más pequeños, mientras nosotros tenemos 4 slots y 34K de contexto.

---

## 7. Problemas detectados

### 7.1. `.env` desincronizado con el container

| Parámetro | `.env` | Container real |
|-----------|--------|----------------|
| `LLAMA_CTX_SIZE` | `32768` | `34305` |

**Causa**: El container fue recreado con un valor de contexto diferente (posiblemente vía `POST /api/models/reload` con `ctxSize` diferente).

**Impacto**: Confusión sobre la configuración real. El `.env` no refleja el estado del sistema.

### 7.2. 4 slots innecesarios

El servidor arranca con `n_slots = 4` (default de llama.cpp), pero solo se usa 1 slot a la vez.

**Impacto**:
- El KV cache se divide entre 4 slots: `per-slot context = 34305 / 4 ≈ 8,576 tokens`
- Se reserva VRAM para 4 slots aunque solo 1 está activo
- Con 1 slot, todo el contexto (34K) estaría disponible para una sola petición

### 7.3. Sin KV cache quantization

El KV cache está en f16 (default). Con q8_0 se reduciría a la mitad con pérdida insignificante.

**Estimación de ahorro**:
- KV cache actual (f16, 34K ctx, 9B model): ~2-3 GB
- KV cache con q8_0: ~1-1.5 GB
- **Ahorro**: ~1-1.5 GB de VRAM libre

### 7.4. Sin configuración de threads

No se especifican `--threads` ni `--threads-batch`. llama.cpp usa auto-detect, que puede ser subóptimo para el i7-3770.

**Recomendación**: `--threads 4 --threads-batch 4` (core count físico, no logical).

### 7.5. Gemma 4 E4B requiere chat template explícito

El modelo `gemma-4-e4b` necesita `--chat-template gemma` para funcionar correctamente. Si se carga con `auto`, el template puede no ser el correcto.

### 7.6. Sin parámetros de sampling configurables

No hay forma de configurar `--temp`, `--top-p`, `--top-k` vía `.env`. Estos se pasan por request en la API, pero no hay defaults del servidor.

---

## 8. Parámetros NO expuestos (candidatos a agregar)

| Parámetro | Flag | Efecto | Impacto estimado |
|-----------|------|--------|------------------|
| KV Cache K type | `--cache-type-k` | Quantización del cache de keys | Libera ~1 GB VRAM |
| KV Cache V type | `--cache-type-v` | Quantización del cache de values | Libera ~1 GB VRAM |
| Parallel slots | `--parallel` | Número de slots concurrentes | +Contexto por slot |
| Threads | `--threads` | Threads CPU para generación | +5-10% tok/s |
| Threads batch | `--threads-batch` | Threads CPU para prefill | +5-10% prompt speed |
| Batch size | `--batch-size` | Tamaño de batch para prefill | +Prompt speed |
| Ubatch size | `--ubatch-size` | Batch físico por step | Optimización interna |
| Context checkpoints | `--ctx-checkpoints` | Checkpoints de contexto (Gemma 4) | Previene OOM |
| Sampling defaults | `--temp`, `--top-p`, etc. | Defaults del servidor | Consistencia |

---

## 9. Cambios realizados recientemente

| Fecha | Cambio | Evidencia |
|-------|--------|-----------|
| 2026-09-17 ~02:54 | Descarga de Gemma 4 12B QAT GGUF | `gemma-4-12B-it-qat-UD-Q4_K_XL.gguf` en logs |
| 2026-09-17 ~02:58 | Descarga de mmproj y MTP drafter | `mmproj-BF16.gguf`, `mtp-gemma-4-12B-it.gguf` |
| 2026-09-17 ~03:00 | Container recreado con Gemma 4 12B | Logs muestran flags con 12B |
| 2026-09-17 ~03:15 | Prueba de la 12B (5 tok/s) | Prompt processing + generation logs |
| 2026-09-17 ~03:25 | Vuelta a Qwen3.5-9B | Container recreado, modelo activo: qwen3.5-9b |
| 2026-09-17 ~03:30 | Eliminación de modelos 12B del disco | No aparecen en `ls -lhS /models/` |

---

## 10. Endpoint de la API

### Modelos disponibles vía API

```json
GET /api/status →
{
  "loadedModel": "qwen3.5-9b",
  "gpu": {
    "vramTotalMiB": 8151,
    "vramUsedMiB": 6586,
    "vramFreeMiB": 1326
  },
  "models": [
    { "id": "gemma-4-e4b", "vision": true },
    { "id": "mistral-small-7b", "vision": false },
    { "id": "phi-4-mini", "vision": false },
    { "id": "qwen3.5-4b", "vision": true },
    { "id": "qwen3.5-9b", "vision": false }
  ]
}
```

### Modelos registrados (auto-scanned)

| ID | Visión | mmproj | Tamaño |
|----|--------|--------|--------|
| gemma-4-e4b | Sí | mmproj-gemma-4-e4b.gguf | 4.9 GB |
| mistral-small-7b | No | — | 4.1 GB |
| phi-4-mini | No | — | 2.4 GB |
| qwen3.5-4b | Sí | mmproj-qwen3.5-4b.gguf | 2.6 GB |
| qwen3.5-9b | No | — | 5.0 GB |

---

## 11. Baseline para comparación futura

### Métricas clave a monitorear

| Métrica | Valor actual | Target post-optimización |
|---------|-------------|-------------------------|
| Token generation speed | 43 tok/s | ≥50 tok/s |
| Prompt processing speed | 167 tok/s (avg) | ≥300 tok/s |
| VRAM usada | 6,586 MiB | ≤6,000 MiB (con q8_0 KV) |
| Contexto disponible | ~8,576 tokens/slot (4 slots) | ~16,000+ tokens (1 slot) |
| Slots activos | 4 (1 usado) | 1 (o 2 si se necesita) |

### Comandos para reproducir la medición

```bash
# Verificar estado del runtime
curl -s http://127.0.0.1:8080/health

# Ver modelo cargado
curl -s http://127.0.0.1:8080/v1/models

# Ver métricas de GPU y slots
curl -s -H "x-api-key: llama-engine-dev" http://127.0.0.1:3050/api/status

# Ver logs del container
docker logs --tail 50 llama-runtime

# Verificar VRAM
nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader
```

---

## 12. Resultados post-optimización (2026-09-17)

### Cambios implementados

| Archivo | Cambio |
|---------|--------|
| `.env` | Agregadas: `LLAMA_CACHE_TYPE_K=q8_0`, `LLAMA_CACHE_TYPE_V=q8_0`, `LLAMA_PARALLEL=1`, `LLAMA_THREADS=4`, `LLAMA_THREADS_BATCH=4`. Reducido `LLAMA_CTX_SIZE` de 32768 a 16384. |
| `entrypoint.sh` | Agregado soporte para nuevas variables: KV cache, parallel, threads. |
| `docker-compose.yml` | Agregadas nuevas variables de entorno + volumen para entrypoint.sh. |

### Flags de llama-server (post-optimización)

```
--model /models/qwen3.5-9b.gguf
--host 0.0.0.0
--port 8080
--ctx-size 16384
--n-gpu-layers 999
--flash-attn on
--cache-type-k q8_0
--cache-type-v q8_0
--parallel 1
--threads 4
--threads-batch 4
--alias qwen3.5-9b
--no-webui
```

### Comparación de métricas

| Métrica | Antes | Después | Cambio |
|---------|-------|---------|--------|
| VRAM usada | 6,586 MiB | 5,621 MiB | **-965 MiB (15%)** |
| VRAM libre | 1,326 MiB | 2,291 MiB | **+965 MiB** |
| Token generation | 43 tok/s | 45 tok/s | **+2 tok/s (+5%)** |
| Prompt processing | 167 tok/s (avg) | 177 tok/s | **+10 tok/s (+6%)** |
| Contexto total | 34,305 tokens | 16,384 tokens | -17,921 tokens |
| Contexto/slot | ~8,576 tokens | 16,384 tokens | **+7,808 tokens (+91%)** |
| Slots | 4 (1 usado) | 1 | Optimizado |

### Análisis

1. **VRAM liberada**: ~1 GB gracias a KV cache q8_0 y reducción de slots
2. **Velocidad mantenida**: La generación de tokens se mantiene en ~45 tok/s
3. **Contexto por slot mejorado**: De ~8.5K a 16K tokens por petición
4. **Headroom para otros modelos**: Con 2.3 GB libres, ahora hay espacio para cargar modelos más pequeños o para el KV cache de Gemma 4 E4B

### Pendiente

- [ ] Rebuild de la imagen Docker para que el entrypoint.sh quede bakeado (el volumen mount es una solución temporal)
- [ ] Probar con Gemma 4 E4B (multimodal) como modelo alternativo
- [ ] Considerar `LLAMA_CTX_SIZE=32768` con q8_0 KV si se necesita más contexto

---

## 13. Próximos pasos

1. ~~**Agregar KV cache quantization**~~ ✅ Implementado
2. ~~**Reducir slots a 1**~~ ✅ Implementado
3. ~~**Configurar threads**~~ ✅ Implementado
4. ~~**Agregar variables al `.env` y `entrypoint.sh`**~~ ✅ Implementado
5. ~~**Rebuild del runtime**~~ ✅ Recreado con volumen mount
6. ~~**Benchmark post-optimización**~~ ✅ Completado
7. **Probar con Gemma 4 E4B** (multimodal) como modelo alternativo
8. **Rebuild de imagen Docker** para bakear el entrypoint.sh actualizado
