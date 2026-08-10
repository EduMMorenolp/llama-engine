# llama-runtime — llama.cpp (llama-server) compilado con CUDA 12.8 + soporte Blackwell (sm_120)
# La imagen oficial se compila con CUDA 12.4 (sin kernels sm_120), por eso build desde fuente.

# ---------- Etapa build ----------
FROM nvidia/cuda:12.8.0-cudnn-devel-ubuntu22.04 AS build

# Build tools + llama.cpp
RUN apt-get update && apt-get install -y --no-install-recommends \
        git cmake build-essential curl \
    && rm -rf /var/lib/apt/lists/*

# Compilar con arquitectura Blackwell (rtx 50xx) y flash attention.
# sm_120 = RTX 5090/5080/5070/5050 (compute capability 12.0).
RUN git clone --depth 1 https://github.com/ggml-org/llama.cpp.git /src \
    && cmake -S /src -B /src/build \
        -DGGML_CUDA=ON \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_CUDA_ARCHITECTURES=120 \
        -DGGML_CUDA_FA=ON \
        -DGGML_CUDA_FA_ALL_QUANTS=ON \
        -DLLAMA_CURL=ON \
        -DLLAMA_BUILD_TESTS=OFF \
        -DCMAKE_EXE_LINKER_FLAGS="-L/usr/local/cuda/lib64/stubs -lcuda" \
        -DCMAKE_SHARED_LINKER_FLAGS="-L/usr/local/cuda/lib64/stubs -lcuda" \
    && cmake --build /src/build --config Release -j $(nproc) \
    && cmake --install /src/build --prefix /out

# ---------- Etapa runtime ----------
FROM nvidia/cuda:12.8.0-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /models /workspace

COPY --from=build /out/bin/ /usr/local/bin/
COPY --from=build /out/lib/ /usr/local/lib/
ENV LD_LIBRARY_PATH=/usr/local/lib

WORKDIR /workspace
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]