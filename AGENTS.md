# Guía para agentes

## Alcance

Estas instrucciones aplican a todo el repositorio. Antes de cambiar comportamiento,
consultá [`README.md`](./README.md), [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md) y
[`docs/INSTALL.md`](./docs/INSTALL.md).

## Arquitectura

- `llama-runtime/`: compila y ejecuta `llama-server` de llama.cpp con CUDA.
- `engine-api/`: wrapper Express/TypeScript, proxy OpenAI-compatible, telemetría y control
  del contenedor runtime.
- `engine-ui/`: SPA React/Vite para telemetría.
- `docker-compose.yml`: orquesta runtime, API, UI y trainer.
- `models/`: modelos GGUF locales; no deben versionarse.

Conservá la separación entre la API y el runtime. Los modelos se montan desde `models/` y
se seleccionan mediante `LLAMA_MODEL` en `.env`; no hardcodees rutas de modelos en el código.

## Desarrollo y validación

Ejecutá los comandos desde la carpeta del paquete correspondiente:

```powershell
cd engine-api
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

```powershell
cd engine-ui
npm ci
npm run lint
npm run build
```

Para validar la infraestructura:

```powershell
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Si solo cambia `llama-runtime`, preferí `docker compose build llama-runtime`.
Los builds de CUDA pueden tardar varios minutos y requieren Docker con soporte NVIDIA.

## Convenciones

- Usá TypeScript, React y los patrones existentes antes de introducir nuevas abstracciones.
- Respetá Biome: tabs, ancho de línea 100, comillas dobles y punto y coma.
- Validá entradas en la API con los esquemas Zod existentes y mantené los errores explícitos.
- Agregá o actualizá pruebas cuando cambie lógica de la API.
- Mantené los cambios quirúrgicos y actualizá la documentación directamente relacionada.
- No confirmes `.env`, credenciales, tokens, datasets privados ni archivos `.gguf`.
- No modifiques archivos generados (`dist/`, builds de Vite o dependencias instaladas).

## Docker y modelos

Los modelos deben estar en formato GGUF dentro de `models/`, con nombre
`<id>.gguf`. Para modelos con visión se puede agregar `mmproj-<id>.gguf`.
El valor de `LLAMA_MODEL` debe coincidir con `<id>` sin la extensión.

Al cambiar solo el modelo no hace falta reconstruir la imagen; reiniciá el runtime:

```powershell
docker compose up -d llama-runtime
docker compose logs -f llama-runtime
```
