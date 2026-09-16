# engine-ui-agent

> Chat interface for the engine-agent — a React SPA with streaming, markdown, and tool integration.

## What it does

Provides a web-based chat interface to interact with the engine-agent backend. Supports real-time streaming, markdown rendering, tool calls visualization, file uploads, and slash commands.

## Stack

| Layer | Technology | Detail |
|-------|-----------|--------|
| Runtime | Node.js + TypeScript | ESM |
| Build | Vite | React SPA |
| State | React hooks | useState/useCallback/useEffect |
| Styling | CSS | Custom design tokens |
| Markdown | react-markdown + remark-gfm | GFM tables, code blocks |
| Code highlighting | react-syntax-highlighter | Prism + oneDark theme |
| Linting | Biome | NO ESLint/Prettier |

## Architecture

```
src/
├── main.tsx
├── App.tsx
├── index.css
├── api.ts                    # API types and functions
├── utils.ts                  # Utility functions
├── lib/
│   └── api-client.ts         # Single HTTP client
├── providers/
│   └── ToastProvider.tsx     # Toast notifications
├── features/
│   ├── chat/
│   │   ├── components/
│   │   │   ├── ChatView.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── Composer.tsx
│   │   │   ├── AttachMenu.tsx
│   │   │   ├── ToolSelector.tsx
│   │   │   ├── SystemPromptModal.tsx
│   │   │   └── FileUpload.tsx
│   │   └── hooks/
│   │       └── useChat.ts
│   └── sessions/
│       ├── components/
│       │   └── SessionList.tsx
│       └── hooks/
│           └── useSessions.ts
└── components/
    ├── layout/
    │   └── Layout.tsx
    └── ui/
```

## Requirements

- Node.js >= 18
- npm / pnpm

## Setup

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start development server
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run check` | Biome lint + format |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_AGENT_URL` | `http://localhost:3060` | Engine agent backend URL |
| `VITE_AGENT_KEY` | `""` | API key for authentication |

## Services and ports

| Service | Port | Description |
|---------|------|-------------|
| engine-ui-agent | 3061 | Vite dev server |

## Features

- **Markdown rendering** with GFM support (tables, lists, task lists)
- **Code blocks** with syntax highlighting and copy button
- **Thinking/reasoning** collapsible sections
- **Streaming** with progressive markdown rendering
- **Tool calls** display with status indicators
- **Slash commands** palette (`/ayuda`, `/buscar`, `/tools`, `/clear`)
- **File upload** with preview and attachment chips
- **System prompt** modal editor
- **Tool selector** with toggle checkboxes
- **Toast notifications** (success, error, info, warning)
- **Dark theme** with glassmorphism design
- **Auto-reconnect** WebSocket with exponential backoff

## Documentation

- [CHANGELOG.md](./CHANGELOG.md)

## License

MIT
