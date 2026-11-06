# Integración de Llama Engine con Hermes Agent

Hermes puede usar **llama-engine** como proveedor de modelos local vía su API
**OpenAI-compatible** (`/v1`), sin salir de tu red. Es la misma integración que ya
usa opencode, pero con la configuración propia de Hermes (`providers:` + `model_aliases:`).

## 1. Configuración del proveedor

Editá el `config.yaml` de Hermes y agregá un bloque `providers:` **a nivel raíz**:

- Windows: `%LOCALAPPDATA%\hermes\config.yaml` (p. ej. `C:\Users\<user>\AppData\Local\hermes\config.yaml`)
- Linux/macOS: `~/.hermes/config.yaml`

```yaml
providers:
  llama-engine:
    base_url: "http://localhost:3050/v1"
    api_key: "llama-engine-dev"      # == ENGINE_API_KEY del .env de llama-engine
    api_mode: chat_completions
    models:
      qwen3.5-4b:       { context_length: 32768 }
      qwen3.5-9b:       { context_length: 32768 }
      mistral-small-7b: { context_length: 32768 }
      phi-4-mini:       { context_length: 16384 }
```

> `api_key` debe coincidir con `ENGINE_API_KEY` del `.env` de llama-engine
> (por defecto `llama-engine-dev`). Hermes envía la credencial como
> `Authorization: Bearer`; el `engine-api` la acepta igual que `x-api-key`.
>
> El endpoint local no reporta `context_length` en `/v1/models`, por eso se fija
> por modelo. Ajustá los valores si cambiás `LLAMA_CTX_SIZE`.

### Alias corto (opcional)

Para cambiar con una sola palabra desde `/model`:

```yaml
model_aliases:
  qwen-local:
    model: qwen3.5-4b
    provider: llama-engine
    base_url: "http://localhost:3050/v1"
    api_key: "llama-engine-dev"
```

## 2. Selección del modelo

```bash
# Una invocación puntual (no cambia el default)
hermes chat --provider llama-engine --model qwen3.5-4b

# Dentro de una sesión
/model --provider llama-engine qwen3.5-4b
/model qwen-local        # si definiste el alias
```

> El bloque `model:` (modelo por defecto global, p. ej. `nous`) **no se modifica**:
> llama-engine se elige explícitamente. Si querés que sea el default, poné
> `provider: "custom"` y `base_url: "http://localhost:3050/v1"` en `model:`.

## 3. Notas

- **Thinking (Qwen3.5)**: el modelo emite su razonamiento en `reasoning_content`
  y recién después el texto en `content`. Hermes lo soporta. Si querés respuestas
  directas sin thinking, pasá en el request `chat_template_kwargs` con
  `enable_thinking: false`.
- **Tool calling**: verificado — `llama-server` devuelve `tool_calls` reales
  (`finish_reason: "tool_calls"`), por lo que el uso agéntico de Hermes funciona.
- **Modelos disponibles**: el registro detecta los GGUFs montados en `./models/`
  (`qwen3.5-4b`, `qwen3.5-9b`, `mistral-small-7b`, `phi-4-mini`, …). `GET /v1/models`
  los lista.

## 4. Troubleshooting

| Problema | Solución |
|----------|----------|
| `Connection refused` | Verificá el stack: `curl http://localhost:3050/api/health`. |
| `401` / `invalid api key` | `api_key` debe ser igual a `ENGINE_API_KEY` del `.env`. Reiniciá Hermes. |
| `provider 'llama-engine' has no endpoint configured` | Falta el bloque `providers.llama-engine.base_url` en `config.yaml`. |
| Respuesta vacía en tareas cortas | El modelo gastó el presupuesto en thinking (`reasoning_content`). Subí el límite de salida o desactivá thinking. |
| Modelo devuelve 400 | Verificá que el GGUF esté montado y que el `model` coincida con un id del registro. |
| Sin GPU | Revisá `docs/INSTALL.md` § GPU no detectada. |
| Lento | El primer prompt carga el modelo; usá un GGUF cuantizado a GPU (p. ej. Q4_K_M). |
