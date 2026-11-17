#!/usr/bin/env bash
# Llama-engine runtime entrypoint
# Compone los flags de llama-server segun variables de entorno y arranca.
#
# Modelo: /models/<LLAMA_MODEL>.gguf  (id del modelo, p.ej. "qwen3.5-4b")
# Vision: /models/mmproj-<LLAMA_MODEL>.gguf  (si existe, se pasa con --mmproj)

set -euo pipefail

MODEL_ID="${LLAMA_MODEL:-}"
MODEL_FILE="/models/${MODEL_ID}.gguf"
MMPROJ_FILE="/models/mmproj-${MODEL_ID}.gguf"

if [[ -z "$MODEL_ID" ]]; then
  echo "LLAMA_MODEL no definido. Ej.: qwen3.5-4b (requiere /models/qwen3.5-4b.gguf)" >&2
  exit 1
fi
if [[ ! -f "$MODEL_FILE" ]]; then
  echo "No existe el modelo $MODEL_FILE. Monta los GGUFs en ./models" >&2
  exit 1
fi

GPU_LAYERS="${LLAMA_GPU_LAYERS:-${LLAMA_NGPU:--1}}"

ARGS=(--model "$MODEL_FILE")
ARGS+=(--host 0.0.0.0)
ARGS+=(--port 8080)
ARGS+=(--ctx-size "${LLAMA_CTX_SIZE:-32768}")
ARGS+=(--n-gpu-layers "$GPU_LAYERS")

FLASH_VAL="${LLAMA_FLASH_ATTN:-on}"
case "${FLASH_VAL,,}" in
  1|on|true|yes)
    ARGS+=(--flash-attn on)
    ;;
  auto)
    ARGS+=(--flash-attn auto)
    ;;
  0|off|false|no)
    ARGS+=(--flash-attn off)
    ;;
  *)
    ARGS+=(--flash-attn on)
    ;;
esac

CHAT_TEMPLATE="${LLAMA_CHAT_TEMPLATE:-auto}"
if [[ "$CHAT_TEMPLATE" != "auto" && -n "$CHAT_TEMPLATE" ]]; then
  ARGS+=(--chat-template "$CHAT_TEMPLATE")
fi

# --- Optimizacion: KV cache quantization ---
if [[ -n "${LLAMA_CACHE_TYPE_K:-}" ]]; then
  ARGS+=(--cache-type-k "$LLAMA_CACHE_TYPE_K")
fi
if [[ -n "${LLAMA_CACHE_TYPE_V:-}" ]]; then
  ARGS+=(--cache-type-v "$LLAMA_CACHE_TYPE_V")
fi

# --- Optimizacion: parallel slots ---
if [[ -n "${LLAMA_PARALLEL:-}" ]]; then
  ARGS+=(--parallel "$LLAMA_PARALLEL")
fi

# --- Optimizacion: threads ---
if [[ -n "${LLAMA_THREADS:-}" ]]; then
  ARGS+=(--threads "$LLAMA_THREADS")
fi
if [[ -n "${LLAMA_THREADS_BATCH:-}" ]]; then
  ARGS+=(--threads-batch "$LLAMA_THREADS_BATCH")
fi

# --- Optimizacion: batch / ubatch ---
if [[ -n "${LLAMA_BATCH:-}" ]]; then
  ARGS+=(--batch-size "$LLAMA_BATCH")
fi
if [[ -n "${LLAMA_UBATCH:-}" ]]; then
  ARGS+=(--ubatch-size "$LLAMA_UBATCH")
fi

# --- Context extension / RoPE ---
if [[ -n "${LLAMA_ROPE_FREQ_BASE:-}" ]]; then
  ARGS+=(--rope-freq-base "$LLAMA_ROPE_FREQ_BASE")
fi
if [[ -n "${LLAMA_ROPE_FREQ_SCALE:-}" ]]; then
  ARGS+=(--rope-freq-scale "$LLAMA_ROPE_FREQ_SCALE")
fi

# --- Jinja / Tool calling & Reasoning format ---
if [[ "${LLAMA_JINJA:-}" == "1" || "${LLAMA_JINJA:-}" == "true" || "${LLAMA_JINJA:-}" == "on" ]]; then
  ARGS+=(--jinja)
fi
if [[ -n "${LLAMA_REASONING_FORMAT:-}" && "${LLAMA_REASONING_FORMAT}" != "auto" ]]; then
  ARGS+=(--reasoning-format "$LLAMA_REASONING_FORMAT")
fi

# --- Adaptador LoRA en caliente ---
if [[ -n "${LLAMA_LORA:-}" && -f "/models/${LLAMA_LORA}.gguf" ]]; then
  ARGS+=(--lora "/models/${LLAMA_LORA}.gguf")
fi

# Vision: si existe mmproj del modelo, activar multimodal
if [[ "${LLAMA_MMPROJ:-auto}" == "auto" && -f "$MMPROJ_FILE" ]]; then
  ARGS+=(--mmproj "$MMPROJ_FILE")
elif [[ "${LLAMA_MMPROJ:-auto}" != "auto" && "${LLAMA_MMPROJ:-}" != "off" && -f "/models/${LLAMA_MMPROJ}.gguf" ]]; then
  ARGS+=(--mmproj "/models/${LLAMA_MMPROJ}.gguf")
fi

# Alias para el picker de modelos (openai /v1/models devuelve este id)
ARGS+=(--alias "$MODEL_ID")
ARGS+=(--no-webui)

echo "==> llama-server flags: ${ARGS[*]}"
exec llama-server "${ARGS[@]}"
