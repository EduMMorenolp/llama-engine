# Changelog

## Unreleased

- **Added**: MCP (Model Context Protocol) integration and modal (`MCPServersModal.tsx`). Supports viewing configured servers, connect/disconnect toggles, tool count indicators, adding custom command-based servers, and default preset integrations (Memory Graph, Fetch, Filesystem). [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/components/MCPServersModal.tsx`, `src/features/chat/components/AttachMenu.tsx`, `src/api.ts`, `src/index.css`. [2026-09-16]

- **Added**: Expandable AI Model dropdown selector with provider badges (Default, Meta, Reasoning, Anthropic, OpenAI), descriptions, and outside click auto-close. [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/components/ChatView.tsx`, `src/index.css`. [2026-09-16]

- **Added**: File attachment content extraction and prompt injection for text and code files (`.md`, `.txt`, `.json`, `.ts`, `.py`, `.js`, etc.) using `FileReader.readAsText`. [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/components/FileUpload.tsx`, `src/features/chat/components/ChatView.tsx`. [2026-09-16]

- **Added**: Dynamic tool enabling/disabling sync over WebSocket with `enabledTools` option passed from composer to agent backend. [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/components/Composer.tsx`, `src/features/chat/hooks/useChat.ts`. [2026-09-16]

- **Added**: Centralized `SessionsProvider` React context ensuring seamless shared session switching, message loading, and active session synchronization across sidebar and chat views. [2026-09-16]
  * **Files (Archivos)**: `src/providers/SessionsProvider.tsx`, `src/App.tsx`, `src/features/sessions/hooks/useSessions.ts`. [2026-09-16]

- **Fixed**: Sidebar collapse layout overflow preventing branding and navigation overlap with header model selector. [2026-09-16]
  * **Files (Archivos)**: `src/index.css`. [2026-09-16]

- **Fixed**: Centered system prompt dialog and backdrop overlay with glassmorphism styling and smooth entrance animations. [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/components/SystemPromptModal.tsx`, `src/index.css`. [2026-09-16]

- **Fixed**: Removed duplicate agent tools item from composer attach menu (`+`). [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/components/AttachMenu.tsx`. [2026-09-16]

- **Added**: Markdown rendering with GFM support (tables, lists, task lists). Code blocks with syntax highlighting and copy button. Thinking/reasoning sections collapsible. Streaming with progressive markdown rendering. [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/components/MessageBubble.tsx`, `src/index.css`. [2026-09-16]

- **Added**: Tool calls display as collapsible cards with status indicators (pending/done/error). Auto-reconnect WebSocket with exponential backoff. Connection state indicator. [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/hooks/useChat.ts`, `src/features/chat/components/ChatView.tsx`. [2026-09-16]

- **Added**: Floating composer with attach button (+), model selector, and token counter. Modern dark obsidian UI design inspired by Claude, Gemini, ChatGPT, and DeepSeek. [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/components/Composer.tsx`, `src/index.css`. [2026-09-16]

- **Added**: Toast notification system (success, error, info, warning) with auto-dismiss and slide-in animation. [2026-09-16]
  * **Files (Archivos)**: `src/providers/ToastProvider.tsx`. [2026-09-16]

- **Added**: View states (loading skeleton, empty state, error with retry). Centered hero starter cards. [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/components/ChatView.tsx`. [2026-09-16]

- **Changed**: Feature-based project structure. Single HTTP client in `lib/api-client.ts`. Components organized by domain (chat, sessions). [2026-09-16]
  * **Files (Archivos)**: `src/lib/api-client.ts`, `src/api.ts`, `src/features/`, `src/components/`. [2026-09-16]

