#!/usr/bin/env bash
# Llama-engine runtime entrypoint
# Compone los flags de llama-server según variables de entorno y arranca.
#
# Modelo: /models/<LLAMA_MODEL>.gguf  (id del modelo, p.ej. "qwen3.5-4b")
# Visión: /models/mmproj-<LLAMA_MODEL>.gguf  (si existe, se pasa con --mmproj)

set -euo pipefail

MODEL_ID="${LLAMA_MODEL:-}"
MODEL_FILE="/models/${MODEL_ID}.gguf"
MMPROJ_FILE="/models/mmproj-${MODEL_ID}.gguf"

if [[ -z "$MODEL_ID" ]]; then
  echo "LLAMA_MODEL no definido. Ej.: qwen3.5-4b (requiere /models/qwen3.5-4b.gguf)" >&2
  exit 1
fi
if [[ ! -f "$MODEL_FILE" ]]; then
  echo "No existe el modelo $MODEL_FILE. Montá los GGUFs en ./models" >&2
  exit 1
fi

ARGS=(--model "$MODEL_FILE")
ARGS+=(--host 0.0.0.0)
ARGS+=(--port 8080)
ARGS+=(--ctx-size "${LLAMA_CTX_SIZE:-32768}")
ARGS+=(--n-gpu-layers "${LLAMA_NGPU:--1}")

if [[ "${LLAMA_FLASH_ATTN:-1}" == "1" ]]; then
  ARGS+=(--flash-attn on)
fi

CHAT_TEMPLATE="${LLAMA_CHAT_TEMPLATE:-auto}"
if [[ "$CHAT_TEMPLATE" != "auto" && -n "$CHAT_TEMPLATE" ]]; then
  ARGS+=(--chat-template "$CHAT_TEMPLATE")
fi

# Vision: si existe mmproj del modelo, activar multimodal
if [[ "${LLAMA_MMPROJ:-auto}" == "auto" && -f "$MMPROJ_FILE" ]]; then
  ARGS+=(--mmproj "$MMPROJ_FILE")
elif [[ "${LLAMA_MMPROJ}" != "auto" && -f "/models/${LLAMA_MMPROJ}.gguf" ]]; then
  ARGS+=(--mmproj "/models/${LLAMA_MMPROJ}.gguf")
fi

# Alias para el picker de modelos (openai /v1/models devuelve este id)
ARGS+=(--alias "$MODEL_ID")
ARGS+=(--no-webui)

echo "==> llama-server flags: ${ARGS[*]}"
exec llama-server "${ARGS[@]}"