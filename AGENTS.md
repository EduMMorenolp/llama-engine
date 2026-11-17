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

## Flujo de ramas y despliegue en Docker (Obligatorio)

- **Rama por feature desde `master`**: Siempre que se trabaje en una nueva feature o mejora, se debe crear y cambiar a una nueva rama partiendo desde `master` (por ejemplo, `git checkout master && git checkout -b feat/<nombre-descriptivo>`). Nunca desarrolles features directamente sobre `master`.
- **Deploy y verificación en Docker**: Todo cambio o nueva feature debe desplegarse en Docker y verificarse en ejecución (`docker compose ps`, healthchecks y pruebas contra los endpoints/UI activos) para comprobar que la feature funciona correctamente de punta a punta antes de dar por finalizada la tarea.
  - **Importante (`--no-deps`)**: Como `engine-api` tiene `depends_on: [llama-runtime, llama-trainer]`, al reconstruir solo la API o la UI usá siempre **`docker compose up -d --build --no-deps engine-api engine-ui-telemetry`** para no disparar por arrastre un rebuild pesado de CUDA/PyTorch en `llama-runtime` o `llama-trainer`.

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
- **Documentación y sección Ayuda de `engine-ui` (Obligatorio)**: Siempre que se hagan cambios o se agreguen nuevas features/endpoints/pantallas, se deben mantener actualizados tanto `CHANGELOG.md` y `docs/` como la sección **Ayuda & Integración API** de `engine-ui` (`engine-ui/src/info.ts` y `engine-ui/src/components/help/HelpPage.tsx`: snippets listos para usar, atajos de teclado, manual de operación y changelog interno de la UI). 

## Docker y modelos

Los modelos deben estar en formato GGUF dentro de `models/`, con nombre
`<id>.gguf`. Para modelos con visión se puede agregar `mmproj-<id>.gguf`.
El valor de `LLAMA_MODEL` debe coincidir con `<id>` sin la extensión.

Al cambiar solo el modelo no hace falta reconstruir la imagen; reiniciá el runtime:

```powershell
docker compose up -d llama-runtime
docker compose logs -f llama-runtime
```
