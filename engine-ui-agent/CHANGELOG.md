# Changelog

## Unreleased

- **Added**: Markdown rendering with GFM support (tables, lists, task lists). Code blocks with syntax highlighting and copy button. Thinking/reasoning sections collapsible. Streaming with progressive markdown rendering. [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/components/MessageBubble.tsx`, `src/index.css`. [2026-09-16]

- **Added**: Tool calls display as collapsible cards with status indicators (pending/done/error). Auto-reconnect WebSocket with exponential backoff. Connection state indicator. [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/hooks/useChat.ts`, `src/features/chat/components/ChatView.tsx`. [2026-09-16]

- **Added**: Slash commands palette (`/ayuda`, `/buscar`, `/tools`, `/clear`). Keyboard navigation (arrow up/down, enter, escape). [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/components/Composer.tsx`. [2026-09-16]

- **Added**: Floating composer with attach button (+), model selector, and token counter. DeepSeek-style UI design. [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/components/Composer.tsx`, `src/index.css`. [2026-09-16]

- **Added**: Attach menu with options: Add files, System Message, Tools, MCP Servers. Tool selector with toggle checkboxes. System prompt modal using native dialog. File upload with preview and chips. [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/components/AttachMenu.tsx`, `src/features/chat/components/ToolSelector.tsx`, `src/features/chat/components/SystemPromptModal.tsx`, `src/features/chat/components/FileUpload.tsx`. [2026-09-16]

- **Added**: Toast notification system (success, error, info, warning). Auto-dismiss with slide-in animation. [2026-09-16]
  * **Files (Archivos)**: `src/providers/ToastProvider.tsx`. [2026-09-16]

- **Added**: View states (loading skeleton, empty state, error with retry). Empty chat with "Hello there" centered design. [2026-09-16]
  * **Files (Archivos)**: `src/features/chat/components/ChatView.tsx`. [2026-09-16]

- **Changed**: Feature-based project structure. Single HTTP client in `lib/api-client.ts`. Components organized by domain (chat, sessions). [2026-09-16]
  * **Files (Archivos)**: `src/lib/api-client.ts`, `src/api.ts`, `src/features/`, `src/components/`. [2026-09-16]

- **Changed**: Sidebar with logo, New chat, Search, Settings actions. Session list with empty state. [2026-09-16]
  * **Files (Archivos)**: `src/features/sessions/components/SessionList.tsx`, `src/index.css`. [2026-09-16]
