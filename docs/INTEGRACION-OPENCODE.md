# Integración de Llama Engine con opencode

opencode puede usar **llama-engine** como proveedor de modelos local vía su API **OpenAI-compatible**
(`/v1`), sin salir de tu red.

## 1. Configuración del proveedor

En tu `opencode.json` global (o por proyecto), registrá el proveedor:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "llama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Llama Engine (local)",
      "options": {
        "baseURL": "http://localhost:3050/v1",
        "apiKey": "TU_API_KEY"
      },
      "models": {
        "qwen3.5-4b": {
          "name": "Qwen 3.5 4B (llama-engine)"
        },
        "gemma4-4b": {
          "name": "Gemma 4 4B (llama-engine)"
        }
      }
    }
  }
}
```

> `TU_API_KEY` debe coincidir con la `API_KEY` del `.env` de llama-engine. Si no tienes una,
> generá una con `openssl rand -hex 24`.

## 2. Selección del modelo en opencode

```
/regenerate <nombre>
# o al iniciar:
opencode --model llama/qwen3.5-4b
```

## 3. Voz (no incluido en v1)

La **entrada/salida de voz** NO forma parte de la base v1. Para usarla requiere un pipeline
adicional (ASR → LLM → TTS), documentado como **roadmap** en `ARQUITECTURA.md`. Con
llama-engine base obtenés: texto → /v1 → texto (streaming).

Para voz seguirás los pasos de este mismo integración (mismo endpoint), apuntando el agente
de voz al mismo motor cuando el pipeline se agregue.

## 4. Intercambio en redes remotas / VPN

Si la UI, otro PC u opencode consultan el motor desde **otra máquina**, configurá en `.env`:

- Exponer el puerto de la UI/API fuera de `127.0.0.1` (editar `docker-compose.yml`).
- Usar la IP local/VPN en `baseURL` de arriba en vez de `localhost`.

## 5. Troubleshooting

| Problema | Solución |
|----------|----------|
| `Failed to connect` en opencode | Verificá que engine-api responda: `curl http://localhost:3050/api/health` |
| `401` / `invalid api key` | Ajustá `apiKey` en opencode.json y reiniciá opencode. |
| Modelo devuelve 400 | Asegurate el GGUFF montado y que `model` coincida con un id registrado. |
| Sin GPU en el contenedor | Revisa INSTALL § GPU no detectada. |
| Lento | Primer prompt carga el modelo; usá un GGUF cuantizado a GPU (p.ej. Q4_K_M). |