#!/usr/bin/env bash
# Descarga un modelo GGUF desde Hugging Face a ./models con la convención del proyecto.
#
# Convención: models/<id>.gguf  (+ opcional models/mmproj-<id>.gguf para visión).
# El registry (engine-api) detecta los GGUFs montados y marca vision:true si existe el mmproj.
#
# Modelos catalogados (id -> repo:hf + archivo):
#   qwen3.5-4b  (default)  -> ggml-org/Qwen3-4B-GGUF : Qwen3-4B-Q4_K_M.gguf
#   gemma4-4b              -> (editar unset para tu fuente; placeholder)
#
# Uso:
#   ./scripts/download-model.sh                      # descarga el default (qwen3.5-4b)
#   ./scripts/download-model.sh --model gemma4-4b    # otro modelo del catálogo
#   ./scripts/download-model.sh --repo user/repo --file Model.gguf --id mi-id
#   ./scripts/download-model.sh --quant Q8_0         # cambia la cuantización
#   ./scripts/download-model.sh --mmproj             # además descarga el mmproj de visión
#
# Requiere: curl (o wget) y conexión a huggingface.co. No requiere token para repos públicos.

set -euo pipefail

MODELS_DIR="${MODELS_DIR:-./models}"
DEFAULT_MODEL="qwen3.5-4b"

# --- catálogo por defecto: id -> "repo :: archivo" ---
# qwen3.5-4b es un alias local del proyecto que apunta a Qwen3-4B (GGUF oficial de ggml-org).
declare -A CATALOG=(
  ["qwen3.5-4b"]="ggml-org/Qwen3-4B-GGUF :: Qwen3-4B-Q4_K_M.gguf"
)

MODEL="$DEFAULT_MODEL"
REPO=""
FILE=""
ID=""
QUANT="Q4_K_M"
DO_MMPROJ=0
HF_BASE="https://huggingface.co"

# --- parseo de args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --model|-m)     MODEL="$2"; shift 2 ;;
    --repo)         REPO="$2"; shift 2 ;;
    --file)         FILE="$2"; shift 2 ;;
    --id)           ID="$2"; shift 2 ;;
    --quant|-q)     QUANT="$2"; shift 2 ;;
    --mmproj)       DO_MMPROJ=1; shift ;;
    --dir|-d)       MODELS_DIR="$2"; shift 2 ;;
    -h|--help)      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)              echo "❌ Argumento desconocido: $1" >&2; exit 1 ;;
  esac
done

mkdir -p "$MODELS_DIR"

# --- resolución de fuente ---
if [[ -n "$REPO" && -n "$FILE" ]]; then
  ID="${ID:-$MODEL}"
  SOURCE_REPO="$REPO"
  SOURCE_FILE="$FILE"
else
  entry="${CATALOG[$MODEL]:-}"
  if [[ -z "$entry" ]]; then
    echo "❌ Modelo \"$MODEL\" no está en el catálogo." >&2
    echo "   Usá explícitamente: --repo user/repo --file Model.gguf --id mi-id" >&2
    exit 1
  fi
  SOURCE_REPO="${entry% :: *}"
  SOURCE_FILE="${entry#* :: }"
  ID="$MODEL"
  # aplicar cuantización pedida (si no es la del catálogo, reemplazar en el nombre)
  if [[ "$QUANT" != "Q4_K_M" ]]; then
    SOURCE_FILE="${SOURCE_FILE/%-Q4_K_M.gguf/-$QUANT.gguf}"
  fi
fi

TARGET="$MODELS_DIR/$ID.gguf"
URL="$HF_BASE/$SOURCE_REPO/resolve/main/$SOURCE_FILE"

echo "==> Descargando modelo"
echo "    id        : $ID"
echo "    repo      : $SOURCE_REPO"
echo "    archivo   : $SOURCE_FILE"
echo "    destino   : $TARGET"
echo "    url       : $URL"

if [[ -f "$TARGET" && -s "$TARGET" ]]; then
  echo "ℹ️  Ya existe $TARGET. Usá --force si querés sobrescribir." >&2
  exit 0
fi

if command -v curl &>/dev/null; then
  curl -fL --retry 3 -C - -o "$TARGET" "$URL"
  echo "✅ Modelo descargado: $TARGET"
elif command -v wget &>/dev/null; then
  wget -q --retry-connrefused -c -O "$TARGET" "$URL"
  echo "✅ Modelo descargado: $TARGET"
else
  echo "❌ Necesitás curl o wget para descargar." >&2
  exit 1
fi

# --- descarga opcional del mmproj (visión) ---
if [[ "$DO_MMPROJ" == "1" ]]; then
  MMPROJ_URL="$HF_BASE/$SOURCE_REPO/resolve/main/mmproj-$SOURCE_FILE"
  MMPROJ_TARGET="$MODELS_DIR/mmproj-$ID.gguf"
  if [[ -f "$MMPROJ_TARGET" && -s "$MMPROJ_TARGET" ]]; then
    echo "ℹ️  Ya existe $MMPROJ_TARGET." >&2
  else
    if curl -fL --retry 3 -s -o "$MMPROJ_TARGET" "$MMPROJ_URL"; then
      echo "✅ mmproj (visión) descargado: $MMPROJ_TARGET"
    else
      echo "⚠️  No se pudo descargar mmproj para $SOURCE_REPO (¿es multimodal?)." >&2
      rm -f "$MMPROJ_TARGET"
    fi
  fi
fi

echo
echo "Listo. Reiniciá el runtime para que tome el modelo:"
echo "    docker compose restart llama-runtime"