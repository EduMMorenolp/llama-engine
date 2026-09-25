# llama-trainer — Fine-tuning + conversión HF→GGUF + quantización
# Dockerfile multi-stage para entrenamiento y exportación de modelos

# ---------- Etapa build ----------
FROM nvidia/cuda:12.8.0-cudnn-devel-ubuntu22.04 AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
        git cmake build-essential curl python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Clonar llama.cpp para herramientas de conversión y quantización
RUN git clone --depth 1 https://github.com/ggml-org/llama.cpp.git /src/llama.cpp

# Compilar solo herramientas necesarias (quantize para GGUF)
RUN cmake -S /src/llama.cpp -B /src/llama.cpp/build \
        -DGGML_CUDA=ON \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_CUDA_ARCHITECTURES=120 \
        -DLLAMA_BUILD_TESTS=OFF \
        -DCMAKE_EXE_LINKER_FLAGS="-L/usr/local/cuda/lib64/stubs -lcuda" \
        -DCMAKE_SHARED_LINKER_FLAGS="-L/usr/local/cuda/lib64/stubs -lcuda" \
    && cmake --build /src/llama.cpp/build --config Release --target llama-quantize -j $(nproc)

# Instalar dependencias de entrenamiento (HuggingFace stack)
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
RUN pip install --no-cache-dir \
    transformers>=4.45.0 \
    datasets>=3.0.0 \
    peft>=0.13.0 \
    accelerate>=1.0.0 \
    trl>=0.12.0 \
    bitsandbytes>=0.44.0
RUN pip install --no-cache-dir flask>=3.0.0 flask-cors>=4.0.0

# Copiar package del trainer
COPY trainer/ /workspace/trainer/

# ---------- Etapa runtime ----------
FROM nvidia/cuda:12.8.0-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 python3 python3-venv curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar entorno virtual con dependencias HuggingFace
COPY --from=build /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copiar herramientas de llama.cpp
COPY --from=build /src/llama.cpp/build/bin/ /usr/local/bin/
COPY --from=build /src/llama.cpp/convert_hf_to_gguf.py /usr/local/bin/
COPY --from=build /src/llama.cpp/gguf-py/ /opt/gguf-py/
ENV PYTHONPATH="/opt/gguf-py:${PYTHONPATH:-}"

# Copiar código del trainer
COPY --from=build /workspace/trainer/ /workspace/trainer/

# Directorios de trabajo
RUN mkdir -p /data/datasets /data/base /data/output /models /workspace

WORKDIR /workspace
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8081

ENTRYPOINT ["bash", "/usr/local/bin/entrypoint.sh"]
