# llama-runtime — llama.cpp con CUDA y soporte Blackwell

ARG CUDA_IMAGE=nvidia/cuda:12.8.0

# ---------- Etapa de compilacion ----------
FROM ${CUDA_IMAGE}-cudnn-devel-ubuntu22.04 AS build

ARG SM_CUDA_ARCHITECTURES=120

RUN apt-get update && apt-get install -y --no-install-recommends \
        git cmake build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/ggml-org/llama.cpp.git /src/llama.cpp

RUN cmake -S /src/llama.cpp -B /src/llama.cpp/build \
        -DGGML_CUDA=ON \
        -DGGML_CUDA_FA=ON \
        -DGGML_CUDA_FA_ALL_QUANTS=ON \
        -DCMAKE_CUDA_ARCHITECTURES=${SM_CUDA_ARCHITECTURES} \
        -DCMAKE_BUILD_TYPE=Release \
        -DLLAMA_BUILD_TESTS=OFF \
        -DLLAMA_BUILD_EXAMPLES=OFF \
        -DCMAKE_EXE_LINKER_FLAGS="-L/usr/local/cuda/lib64/stubs -lcuda" \
        -DCMAKE_SHARED_LINKER_FLAGS="-L/usr/local/cuda/lib64/stubs -lcuda" \
    && cmake --build /src/llama.cpp/build --config Release --target llama-server -j "$(nproc)" \
    && mkdir -p /opt/llama/bin /opt/llama/lib \
    && cp /src/llama.cpp/build/bin/llama-server /opt/llama/bin/ \
    && cp /src/llama.cpp/build/bin/*.so* /opt/llama/lib/

# ---------- Etapa runtime ----------
FROM ${CUDA_IMAGE}-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
        bash libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /opt/llama/ /usr/local/
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN mkdir -p /models \
    && chmod +x /usr/local/bin/entrypoint.sh

ENV PATH="/usr/local/bin:${PATH}" \
    LD_LIBRARY_PATH="/usr/local/lib:${LD_LIBRARY_PATH}"

WORKDIR /workspace
EXPOSE 8080

ENTRYPOINT ["bash", "/usr/local/bin/entrypoint.sh"]
