# Propuesta de Mejora UI/UX — engine-ui

> **Versión de la propuesta**: 1.0 — 2026-09-24
> **Estado**: Propuesta / Pendiente de aprobación
> **Scope**: Mejora general de experiencia de usuario, nuevas features de configuración, accesibilidad, diseño de sistema

---

## 1. Diagnóstico del estado actual

### Stack actual
- React 19 + Vite + TypeScript strict
- CSS puro con variables (sin framework de estilos)
- Chart.js para gráficos
- React Router para navegación
- Biome para lint/format

### Páginas existentes
| Ruta | Componente | Estado |
|------|-----------|--------|
| `/` | Dashboard | ✅ Funcional |
| `/modelos` | ModelsPage | ✅ Funcional |
| `/modelos/crear` | ModelWizard | ✅ Funcional |
| `/runtime` | RuntimePage | ✅ Funcional |
| `/telemetria` | TelemetryPage | ✅ Funcional |
| `/ayuda` | HelpPage | ✅ Funcional |

### Fortalezas actuales
- Tema dark bien definido con tokens CSS consistentes
- Layout con sidebar + shell responsivo (movil con overlay)
- Wizard de 3 flujos bien estructurado
- Sistema de feedback básico (error/ok/busy)
- Skeleton loaders para estados de carga
- VRAM bar, tabs, cards reutilizables

### Debilidades y gaps identificados

| # | Categoría | Issue actual | Impacto |
|---|-----------|-------------|---------|
| 1 | **Sistema de diseño** | CSS manual con 1780 líneas, sin tokens de componentes estandarizados | Difícil escalar, inconsistente |
| 2 | **Accesibilidad** | ARIA mínimo, sin focus trap, sin roles semanticos completos | No cumple WCAG 2.1 AA |
| 3 | **Navegación** | Sin breadcrumbs, sin atajos de teclado, sin URL state sync | UX de exploración limitada |
| 4 | **Feedback avanzado** | Sin toast/notificaciones, sin confirmation dialogs, sin loading overlay | Usuario pierde contexto |
| 5 | **Formularios** | Sin validación integrada, sin error summary, sin disabled states visuales | Datos incorrectos posibles |
| 6 | **Tablas** | Sin sort, filter, paginación, selección masiva | Escalabilidad de datos |
| 7 | **Configuración** | Sin página de settings/preferences, sin persistencia de preferencias | Usuario no personaliza |
| 8 | **Modo claro** | Solo dark theme, sin toggle light/dark | Diversidad de preferencias |
| 9 | **Onboarding** | Sin tour guiado, sin tooltips contextuales, sin empty states ilustrados | Curva de aprendizaje alta |
| 10 | **Estados vacíos** | Solo texto "sin datos", sin ilustraciones, sin CTA de acción | Frío, poco atractivo |
| 11 | **Responsive tablet** | Breakpoint solo hasta 720px, sin optimización para 720-1024 | Tablet sin experiencia adecuada |
| 12 | **Rendimiento** | Sin memoización agresiva, sin virtualización, sin code-splitting por ruta | Carga lenta en dispositivos |
| 13 | **Internacionalización** | Sin i18n, todo hardcodeado en español | No adaptable |
| 14 | **Error boundaries** | Sin componente de error boundary, errores rompen toda la UI | Crash visual |
| 15 | **Buscar global** | Sin Ctrl+K command palette, sin búsqueda global | Navegación lenta |
| 16 | **Modo offline** | Sin soporte offline, sin cache de datos | Sin uso sin conexión |
| 17 | **Tipografía** | Sin sistema tipográfico modular, sin font tokens | Inconsistencia visual |
| 18 | **Motion design** | Sin animaciones de entrada/salida, sin microinteracciones | Plano, sin vida |
| 19 | **Dark/Light toggle** | Sin switcher en topbar | Sin preferencia visual |
| 20 | **Atajos de teclado** | Ninguno | Usuarios avanzados sin power features |

---

## 2. Visión del futuro — 4 fases de implementación

### Fase 1: Fundamentos de diseño y accesibilidad (Semanas 1-3)

**Objetivo**: Crear un sistema de diseño base y llevar la accesibilidad a nivel AA.

#### 2.1. Design Token System (`src/styles/tokens.css`)

Extraer todos los CSS variables actuales a un sistema formal:

```
Color tokens:
  --color-bg-0 a --color-bg-900 (surface levels)
  --color-text-primary, --color-text-secondary, --color-text-muted
  --color-accent, --color-accent-hover, --color-accent-subtle
  --color-danger, --color-danger-hover, --color-danger-subtle
  --color-warn, --color-warn-subtle
  --color-border, --color-border-strong
  --color-success (alias de accent)

Spacing tokens:
  --space-1: 4px, --space-2: 8px, --space-3: 12px, --space-4: 16px,
  --space-5: 20px, --space-6: 24px, --space-8: 32px, --space-10: 40px,
  --space-12: 48px, --space-16: 64px

Radius tokens:
  --radius-none, --radius-sm (8px), --radius-md (12px),
  --radius-lg (16px), --radius-xl (24px), --radius-full (999px)

Typography tokens:
  --font-family-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
  --font-family-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace
  --font-size-xs: 12px, --font-size-sm: 14px, --font-size-base: 14px,
  --font-size-lg: 16px, --font-size-xl: 22px
  --font-weight-regular: 400, --font-weight-medium: 500,
  --font-weight-semibold: 600, --font-weight-bold: 700

Motion tokens:
  --duration-fast: 150ms, --duration-normal: 300ms, --duration-slow: 500ms
  --easing-default: ease, --easing-out: ease-out, --easing-spring: cubic-bezier(...)

Breakpoint tokens:
  --bp-sm: 480px, --bp-md: 720px, --bp-lg: 900px, --bp-xl: 1200px

Shadow tokens:
  --shadow-sm, --shadow-md, --shadow-lg, --shadow-xl
```

#### 2.2. Component Library (`src/components/ui/` — expandir)

Componentes a crear/refactorizar:

| Componente | Estado | Descripción |
|-----------|--------|-------------|
| `Button` | Existente → MEJORAR | Agregar `loading` icon, `iconOnly` variant, `size` prop (sm/md/lg) |
| `Card` | Existente → MEJORAR | Agregar `padding`, `elevated`, `hoverable` props |
| `Badge` | Existente → MEJORAR | Agregar `variant` (success/warning/danger/info), `dot` prop |
| `Input` | **NUEVO** | Text input con label, error, hint, disabled, loading, icon slots |
| `Select` | **NUEVO** | Reemplazar `<select>` nativo con custom component, searchable |
| `Modal` | **NUEVO** | Dialogs con focus trap, overlay, animations, header/body/footer slots |
| `Toast` | **NUEVO** | Notificaciones temporales (success/error/info/warning) |
| `Tooltip` | **NUEVO** | Información contextual al hover |
| `Tabs` | **NUEVO** | Reemplazar `.step-tabs` con componente robusto |
| `Table` | **NUEVO** | Con sort, filter, pagination wrapper |
| `Skeleton` | Existente → MEJORAR | Skeleton por tipo (card, row, text, chart) |
| `EmptyState` | **NUEVO** | Ilustración + título + descripción + CTA |
| `ErrorBoundary` | **NUEVO** | Catch errores de React, pantalla degradada con retry |
| `ConfirmDialog` | **NUEVO** | Diálogo de confirmación para acciones destructivas |
| `SearchBar` | **NUEVO** | Con debounce, suggestions, keyboard nav |

Cada componente debe seguir:
- TypeScript strict con exports tipados
- `aria-*` attributes obligatorios
- `role`, `tabIndex`, `onKeyDown` donde aplique
- `data-testid` para testing
- Prop `className` para overrides
- Documentación JSDoc

#### 2.3. A11y overhaul

Mejoras específicas:

**Sidebar/Nav**:
- `role="navigation"` (ya tiene aria-label)
- `aria-current="page"` en NavLink activa
- `tabIndex="0"` en todos los items navegables (ya existe)

**Wizard**:
- `role="form"` en cada step
- `aria-describedby` vinculando hints a inputs
- `aria-invalid` en campos con error
- Focus management al cambiar de step

**Tables**:
- `scope="col"` en todos los `<th>` (ya parcialmente)
- `aria-sort` en columnas ordenables

**Toast/Notification**:
- `role="alert"` o `role="status"` con `aria-live="polite"`
- `aria-atomic="true"`

**Global**:
- Añadir `<a href="#main" className="skip-link">Saltar al contenido</a>` en `index.html`
- `role="main"` en `<main>` (ya existe como `main className="page"`)
- `role="alert"` en banners de error
- `aria-busy="true"` en zonas de carga
- Verificar contraste de todos los tokens CSS: `--text` (#e6e9f2) sobre `--bg` (#0b0e17) = ratio ~13:1 ✅, `--muted` (#8b93a7) sobre `--bg` = ratio ~5.5:1 ✅ (casi AA)
- `prefers-reduced-motion` media query para desactivar animaciones

#### 2.4. Modo claro/oscuro

- Definir tokens alternativos para modo claro en `tokens.css`
- Crear `src/hooks/useTheme.ts` con toggle en localStorage
- Toggle switch en `Topbar.tsx` (esquina superior derecha)
- Transición suave con `transition: background-color 0.3s ease, color 0.3s ease`
- `data-theme` attribute para CSS overrides

---

### Fase 2: Navegación y descubrimiento (Semanas 4-6)

**Objetivo**: Facilidad de exploración, habilitar power-user features, sincronizar estado con URL.

#### 2.5. Breadcrumbs (`src/components/ui/Breadcrumbs.tsx`)

Generado dinámicamente desde `useLocation()` + `useParams()`:
```
Home / Modelos / qwen3.5-4b
Home / Runtime / Logs
```
- Separador `>` con icono
- Clickable excepto último segmento
- Colapsable en mobile (mostrar solo últimos 2 con "..." dropdown)
- `aria-label="Breadcrumb"`

**Integración**: Agregar en `Layout.tsx` debajo de `<header className="topbar">`.

#### 2.6. Command Palette / Global Search (`src/components/ui/CommandPalette.tsx`)

- Activado con `Ctrl+K` / `Cmd+K` (capturado en `useKeyboardShortcuts`)
- Overlay con input de búsqueda
- Results agrupados por categoría:
  - **Navegación**: Dashboard, Modelos, Runtime, Telemetría, Ayuda, Configuración
  - **Modelos**: Nombres de modelos registrados (de `useRuntime.status?.models`)
  - **Acciones**: "Recargar runtime", "Reiniciar", "Nuevo modelo"
- Keyboard navigation (↑↓ para mover, Enter para seleccionar, Esc para cerrar)
- Búsqueda simple de strings para matching
- Portal-based rendering
- `role="dialog"`, `aria-label="Command palette"`

#### 2.7. URL State Sync

Sincronizar query params con estado:
```
/modelos?selected=qwen3.5-4b&ctxSize=8192
/runtime/logs?tail=200&level=error
/modelos?filter=vision&sort=size&page=2
```
- Usar `useSearchParams()` de `react-router-dom`
- Cada página lee sus filtros de URL al montar
- Cambios de estado actualizan URL (sin duplicar historial)

#### 2.8. Keyboard Shortcuts (`src/hooks/useKeyboardShortcuts.ts`)

| Atajo | Acción |
|-------|--------|
| `Ctrl+K` / `Cmd+K` | Abrir command palette |
| `Ctrl+/` | Focus en search bar de la página actual |
| `Ctrl+N` | Abrir wizard de nuevo modelo |
| `Ctrl+R` | Refresh de datos (re-poll) |
| `Ctrl+Shift+L` | Toggle modo claro/oscuro |
| `?` | Mostrar diálogo de atajos |

Implementación con `useEffect` + `window.addEventListener('keydown')` con filtro para evitar capturar cuando se escribe en inputs.

#### 2.9. Responsive Tablet (720-1024px)

- Sidebar colapsible con overlay incluso en tablet (no solo mobile)
- Grid: `grid-template-columns: repeat(2, 1fr)` en tablet
- Touch-friendly targets: mínimo 44x44px
- Mejor scroll experience en tables
- `clamp()` para texto responsive
- Media queries `@media (max-width: 1024px)` mejoradas

---

### Fase 3: Experiencia de usuario avanzada (Semanas 7-10)

**Objetivo**: Onboarding, empty states ilustrados, sistema de notificaciones, confirmaciones, animaciones.

#### 2.10. Toast Notification System (`src/components/ui/Toast.tsx` + `src/hooks/useToast.ts`)

```typescript
interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message?: string;
  duration?: number;    // default 4000ms
  action?: { label: string; onClick: () => void };
}
```

- `useToast()` hook expone `toast({ type, title, message, action? })`
- Stack de máximo 3 toasts visibles simultáneamente
- Posición: esquina superior derecha
- Auto-dismiss con pause on hover
- Slide-in desde derecha, swipe-to-dismiss en mobile
- Icon por tipo (✓ para success, ✕ para error, ℹ para info, ⚠ para warn)
- Color scheme: verde para success, rojo para error, azul para info, amarillo para warn
- `role="alert"` + `aria-live="polite"`

**Migración**: Reemplazar todos los `<p className="feedback ...">` actuales con toasts. Lugares afectados:
- ModelsPage: download success/error, search error, action feedback
- ModelWizard: step completion notifications
- RuntimePage: restart/stop/start feedback

#### 2.11. Confirm Dialogs

Crear `src/components/ui/ConfirmDialog.tsx`:
```typescript
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
```

**Usos específicos**:
| Acción | Title | Message | Variant |
|--------|-------|---------|---------|
| Reiniciar runtime | "Reiniciar runtime" | "¿Seguro? Se perderán todas las sesiones activas y el modelo se descargará de VRAM." | danger |
| Stop runtime | "Detener runtime" | "¿Detener el runtime? El motor dejará de responder a la API." | danger |
| Stop training | "Detener entrenamiento" | "¿Cancelar el entrenamiento actual? El progreso se perderá." | warning |
| Delete dataset | "Eliminar dataset" | "¿Eliminar este dataset? Esta acción no se puede deshacer." | danger |
| Deploy | "Desplegar modelo" | "¿Desplegar como modelo principal?" | info |

Implementación: Modal con `ConfirmDialog`. Solo se renderiza cuando `open=true`. Focus trap, ESC para cancelar, overlay click-to-cancel.

#### 2.12. Onboarding Tour (`src/components/onboarding/`)

**Flujo**:
1. **Primer visit** → Modal de bienvenida con:
   - Logo + "Bienvenido a llama-engine"
   - 3 pasos: "Ver métricas", "Gestionar modelos", "Configurar runtime"
   - Botón "Empezar tour" → inicia tour guiado
   - Link "Omitir" (guardar en localStorage: `onboarding-completed=true`)

2. **Tour paso a paso**:
   - Highlight del elemento objetivo (overlay oscuro con spotlight)
   - Tooltip con título, descripción y botón "Siguiente"
   - Progress indicator (Paso 1 de 5)
   - Skip/Skip all/Later en cada tooltip
   - Navegación con teclado

3. **Tooltips contextuales persistentes**:
   - Elemento nuevo con badge "NUEVO"
   - Tooltip al hover con explicación
   - Desaparece tras primer hover
   - Guardar estado en localStorage

4. **Puntos del tour**: Dashboard, Modelos, Crear Modelo, Runtime, Telemetría, Configuración

#### 2.13. Empty States Ilustrados (`src/components/ui/EmptyState.tsx`)

```typescript
interface EmptyStateProps {
  illustration: ReactNode;  // SVG o emoji
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}
```

| Página | Title | Description | Action |
|--------|-------|-------------|--------|
| Dashboard | "El motor está en silencio" | "Iniciá el runtime para ver métricas en tiempo real" | Botón "Iniciar runtime" |
| Modelos | "No hay modelos registrados" | "Subí un GGUF o buscá en HuggingFace para empezar" | Botón "Explorar HF" + "Subir modelo" |
| Telemetría | "Esperando datos" | "Conectá el runtime para ver la telemetría" | Botón "Conectar" |
| Runtime | "Configurá el motor" | "Definí el puerto, runtime y directorio de modelos" | Botón "Ver config" |
| Ayuda | "Novedades próximas" | "Más contenido de ayuda disponible próximamente" | Botón "Volver a Dashboard" |

Diseño visual: Centrado, icono/ilustración grande, título en h2, descripción en muted text, botón primario + opcional secundario.

#### 2.14. Animaciones y motion design (`src/styles/animations.css`)

```css
/* Page transitions */
.page-enter {
  opacity: 0;
  transform: translateY(8px);
}
.page-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.3s ease, transform 0.3s ease;
}

/* Card hover */
.card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Button press */
.btn:active {
  transform: scale(0.97);
  transition: transform 0.1s ease;
}

/* Modal */
.modal-overlay {
  opacity: 0;
  transition: opacity 0.2s ease;
}
.modal-open .modal-overlay {
  opacity: 1;
}
.modal {
  transform: scale(0.95) translateY(10px);
  transition: transform 0.2s ease;
}
.modal-open .modal {
  transform: scale(1) translateY(0);
}

/* Stagger children */
.stagger > * {
  opacity: 0;
  animation: fadeUp 0.3s ease forwards;
}
.stagger > *:nth-child(1) { animation-delay: 0s; }
.stagger > *:nth-child(2) { animation-delay: 0.05s; }
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

### Fase 4: Features avanzadas y configuración (Semanas 11-14)

**Objetivo**: Personalización, settings, i18n, performance.

#### 2.15. Settings/Preferences Page (`src/components/settings/`)

Nueva ruta: `/configuracion`

**Secciones:**

**General**:
| Campo | Tipo | Default |
|-------|------|---------|
| Tema | Select (auto/oscuro/claro) | auto |
| Idioma | Select (es/en) | es |
| Polling interval | Select (3s/5s/10s/30s) | 3s |
| Auto-refresh | Toggle | true |
| Compact mode | Toggle | false |

**Runtime**:
| Campo | Tipo | Default |
|-------|------|---------|
| Default context size | Number | auto |
| Default model | Select | — |
| Auto-start runtime | Toggle | false |
| Log level | Select (debug/info/warn/error) | info |
| Default training epochs | Number | 3 |

**Notificaciones**:
| Campo | Tipo | Default |
|-------|------|---------|
| Toast duration | Select (2s/4s/6s/10s) | 4s |
| Sound on error | Toggle | true |
| Show toasts on success | Toggle | true |

**Acerca de**: Versión, Build info, API URL, Licencia (MIT)

Implementación con `react-hook-form` + `@hookform/resolvers` con Zod para validación. Persistencia en `localStorage` bajo clave `engine-ui-settings`.

#### 2.16. Table improvements

`src/components/ui/Table.tsx`:
- Sortable columns (click header)
- Column visibility toggle
- Paginación (10/25/50/100)
- Row selection with bulk actions
- Virtual scrolling para listas grandes (>100 rows)
- Striped rows con hover highlight
- `aria-sort`, `aria-selected`, `role="grid"`
- Responsive: horizontal scroll en mobile

**Integración**: ModelsPage, RuntimePage.

#### 2.17. Form validation

Integrar `react-hook-form` + `@hookform/resolvers` con Zod. Compartir schemas con backend.

**Campos a validar**:
| Formulario | Campos | Reglas |
|-----------|--------|--------|
| Wizard BaseModelStep | modelId | required |
| Wizard DatasetStep | file | required, .jsonl/.json extension |
| Wizard TrainingConfigStep | epochs, learningRate, rank, batchSize, maxSeqLen | min/max/step |
| RuntimeConfig | port, runtimeUrl | port valid, url valid |
| Search | query | min 2 chars |

Implementación: Error summary al top del formulario, inline field errors con icon, `aria-invalid` y `aria-describedby` para a11y.

#### 2.18. i18n foundation (`src/i18n/`)

- Setup `react-i18next`
- Estructura: `src/i18n/locales/es.json`, `src/i18n/locales/en.json`, `src/i18n/index.ts`
- Extraer todos los strings a archivos JSON
- Soporte: `es.json`, `en.json`
- Language switcher en topbar
- Fallback to es
- Lazy load language packs

#### 2.19. Performance optimizations

- `React.memo` en componentes que no cambian frecuentemente
- `useCallback` / `useMemo` agresivos en hooks
- Code splitting por ruta con `React.lazy` + `Suspense`
- Virtual scrolling en tablas/wizard lists
- Debounce en search inputs
- Memoizar datos de Chart.js para evitar re-renders
- `vite-bundle-visualizer` como devDependency para monitoreo

**Bundle target**: < 200KB gzipped (excluyendo React)

---

## 3. Arquitectura propuesta de componentes

### Nueva estructura de carpetas

```
src/
├── components/
│   ├── ui/                    # Componentes base reutilizables
│   │   ├── Button.tsx         # (mejorado)
│   │   ├── Input.tsx          # NUEVO
│   │   ├── Select.tsx         # NUEVO
│   │   ├── Modal.tsx          # NUEVO
│   │   ├── Toast.tsx          # NUEVO
│   │   ├── Tooltip.tsx        # NUEVO
│   │   ├── Tabs.tsx           # NUEVO
│   │   ├── Table.tsx          # NUEVO
│   │   ├── Skeleton.tsx       # MEJORADO
│   │   ├── EmptyState.tsx     # NUEVO
│   │   ├── ErrorBoundary.tsx  # NUEVO
│   │   ├── ConfirmDialog.tsx  # NUEVO
│   │   ├── SearchBar.tsx      # NUEVO
│   │   ├── Badge.tsx          # MEJORADO
│   │   ├── Card.tsx           # MEJORADO
│   │   ├── Avatar.tsx         # NUEVO
│   │   └── index.ts           # Barrel exports
│   ├── layout/                # Sin cambios
│   ├── dashboard/             # Con mejoras
│   ├── models/                # Con tabla mejorada
│   ├── wizard/                # Con animaciones y validación
│   ├── runtime/               # Con settings link
│   ├── telemetry/             # Con mejor chart config
│   ├── help/                  # Sin cambios
│   ├── settings/              # NUEVO
│   ├── onboarding/            # NUEVO
│   └── ui/
├── hooks/
│   ├── useRuntime.ts          # Con toasts integrados
│   ├── useModels.ts           # Con validation
│   ├── useToast.ts            # NUEVO
│   ├── useKeyboard.ts         # NUEVO
│   ├── useTheme.ts            # NUEVO
│   ├── useSettings.ts         # NUEVO
│   ├── useOnboarding.ts       # NUEVO
│   └── useDebounce.ts         # NUEVO
├── styles/
│   ├── tokens.css             # NUEVO
│   ├── animations.css         # NUEVO
│   ├── _mixins.css            # NUEVO
│   ├── reset.css              # MEJORADO
│   └── index.css              # Refactorizado
├── i18n/                      # NUEVO
│   ├── index.ts
│   ├── locales/
│   │   ├── es.json
│   │   └── en.json
│   └── index.ts
├── utils/
│   ├── validation.ts          # NUEVO (Zod schemas compartidos)
│   ├── formatters.ts          # MEJORADO (extraer de helpers.ts)
│   └── constants.ts           # NUEVO
├── App.tsx                    # Con ErrorBoundary + Router mejorado
├── main.tsx                   # Con ThemeProvider
```

---

## 4. Priorización y esfuerzo estimado

| Fase | Features | Esfuerzo | Impacto UX | Impacto código |
|------|----------|----------|-----------|----------------|
| **1** | Design tokens, componentes base, a11y, modo claro | 3 semanas | ⭐⭐⭐⭐⭐ | Alto (refactor base) |
| **2** | Breadcrumbs, command palette, URL sync, shortcuts, tablet | 3 semanas | ⭐⭐⭐⭐ | Medio |
| **3** | Onboarding, empty states, toasts, confirm dialogs, animaciones | 4 semanas | ⭐⭐⭐⭐⭐ | Medio |
| **4** | Settings, tables avanzadas, validación, i18n, perf | 4 semanas | ⭐⭐⭐⭐ | Alto |
| **Total** | | **14 semanas (~3.5 meses)** | | |

### Orden recomendado de implementación dentro de cada fase
Cada fase debe implementarse en orden top-down. Los componentes base de la Fase 1 deben existir antes de usar los de la Fase 3.

---

## 5. Decisiones de diseño clave

### 5.1. ¿CSS framework o CSS puro?
**Decisión: CSS puro + design tokens** (mantener actual enfoque)
- El sistema actual ya tiene tokens bien definidos
- No hay dependencia de framework CSS
- Menor bundle size
- Mayor control sobre el diseño
- Los componentes se construyen sobre tokens, no sobre clases de framework

### 5.2. ¿Library de componentes UI?
**Decisión: Component library custom** (no shadcn/ui, MUI, etc.)
- El diseño actual es único y no necesita "copiar" otro sistema
- Menos dependencias (ya tiene bastante)
- Control total sobre accesibilidad y rendimiento
- Aprendizaje y maintainabilidad interna

### 5.3. ¿Estado global?
**Decisión: Mantener hooks locales + Context solo para settings**
- No usar Redux/Zustand para datos de API (useRuntime ya es suficiente)
- Crear `SettingsContext` para preferencias de usuario
- `ToastContext` para notificaciones globales
- No sobre-arquitecturar

### 5.4. ¿Validación?
**Decisión: Zod para form validation** (ya se usa en backend)
- Compartir schemas con backend si es posible
- Client-side validation con `@hookform/resolvers` + `react-hook-form`
- O mantener validación manual si se prefiere menos dependencias

---

## 6. Métricas de éxito

### Accesibilidad
- Lighthouse a11y score ≥ 90
- WCAG 2.1 AA compliance para todos los componentes
- Navegación completa sin mouse

### Rendimiento
- Lighthouse performance score ≥ 85
- First Contentful Paint < 1.5s
- Time to Interactive < 2s
- Bundle size < 200KB gzipped (excluyendo React)

### Experiencia de usuario
- NPS target: > 70 (encuesta post-implementación)
- Tiempo promedio para completar acción clave < 3 segundos
- Zero "dead clicks" (clics que no generan respuesta)
- Onboarding completado en < 5 minutos

### Mantenibilidad
- TypeScript strict compliance
- Biome sin errores
- Coverage de tests > 80% para componentes UI

---

## 7. Stack adicional recomendado

| Package | Uso | Razón | Riesgo |
|---------|-----|-------|--------|
| `react-hook-form` | Form state management | Menos re-renders que useState | Bajo |
| `@hookform/resolvers` | Zod validation integration | Compartir schemas backend-frontend | Bajo |
| `react-i18next` | i18n | Industry standard para React | Bajo |
| `framer-motion` | Animaciones | Alternativa: CSS only | Medio (bundle) |
| `react-icons` | Iconos | Alternativa: SVG inline actuales | Bajo |
| `date-fns` | Date formatting | Alternativa: toLocaleDateString actual | Bajo |
| `react-window` | Virtual scroll | Alternativa: implementación custom | Bajo |

**Nota**: Agregar dependencias solo si el valor supera el costo de bundle. Evaluar cada una.

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Refactor rompe features existentes | Mantener componentes actuales como `LegacyX` durante transición, migrar página por página |
| Bundle size crece mucho | Tree-shaking, lazy loading, evaluar cada dependencia |
| Curva de aprendizaje del equipo | Documentar tokens, patrones y decisiones en AGENTS.md |
| Tiempo de desarrollo excede estimación | Priorizar features por impacto, hacer MVP de cada fase |
| Inconsistencia durante migración | Crear `MigrationGuide.md` con decisiones por componente |

---

## 9. Próximos pasos

1. **Aprobar propuesta** en equipo
2. **Seleccionar Fase 1** como primer sprint
3. **Crear issue tracker** con epics por fase
4. **Establecer baseline** de métricas actuales (Lighthouse, bundle size)
5. **Definir design review process** para nuevos componentes
6. **Planificar testing** — cada componente nuevo con tests
7. **Documentar** en `AGENTS.md` las decisiones de diseño

---

## 10. Appendix: Mapa de componentes por página

### Dashboard
- MetricTiles (existente, mejorar con skeleton)
- StatusIndicator (existente, mejorar)
- EmptyState (si no hay datos)
- Toast (para refresh notifications)

### ModelsPage
- ModelTable (existente → Table mejorado con sort/filter)
- HFSearch (existente → SearchBar mejorado)
- ConfirmDialog (para delete/actions)
- Toast (para download/action feedback)
- Badge (existente, mejorar)

### ModelWizard
- WizardStepper (existente, con animaciones)
- FlowSelector (existente, con EmptyStates)
- BaseModelStep (existente, con Input mejorado)
- DatasetStep (existente, con Dropzone mejorado)
- TrainingConfigStep (existente, con Form validation)
- TrainingProgressStep (existente, con Toast para completion)
- QuantizeStep (existente, con ConfirmDialog)
- DeployStep (existente, con ConfirmDialog)
- WizardNavigation (existente, con loading overlay)

### RuntimePage
- ConfigTable (existente → Table mejorado)
- LogViewer (existente, con virtual scroll)
- ConfirmDialog (para restart/stop)
- Toast (para action feedback)
- SettingsLink (nuevo: link a `/configuracion`)

### TelemetryPage
- Chart (existente, con ErrorBoundary)
- VRAMBar (existente, mejorar)
- Stats (existente)
- Skeleton (mejorado)

### HelpPage
- Changelog (existente)
- Manual (existente)
- EmptyState (si no hay changelog)

### Settings (nuevo)
- SettingsLayout
- GeneralSettings
- RuntimeSettings
- NotificationSettings
- AboutSection

---

*Esta propuesta es un punto de partida para discusión. Cada feature se implementará con TDD siguiendo el patrón red-green-refactor.*
