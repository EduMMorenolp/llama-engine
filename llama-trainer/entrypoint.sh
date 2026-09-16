#!/usr/bin/env bash
# llama-trainer entrypoint
# Expone la API de entrenamiento, conversión y quantización

set -euo pipefail

TRAINER_PORT="${TRAINER_PORT:-8081}"
DATA_DIR="${DATA_DIR:-/data}"
MODELS_DIR="${MODELS_DIR:-/models}"

echo "==> llama-trainer starting on :${TRAINER_PORT}"
echo "==> data: ${DATA_DIR}"
echo "==> models: ${MODELS_DIR}"

exec python3 -m trainer.server \
    --port "${TRAINER_PORT}" \
    --data-dir "${DATA_DIR}" \
    --models-dir "${MODELS_DIR}"
