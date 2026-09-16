# Changelog

## Unreleased

- **Added**: MCP (Model Context Protocol) subsystem and management (`src/modules/mcp/`). Implements JSON-RPC client communication over `stdio` subprocesses, tool discovery (`tools/list`), dynamic registration in `ToolRegistry`, tool execution (`tools/call`), and REST management endpoints (`/api/mcp/servers`, `/api/mcp/servers/:id/connect`, `/api/mcp/servers/:id/disconnect`). Includes built-in presets: Memory Graph, Filesystem MCP, Fetch & Web Search. [2026-09-16]
  * **Files (Archivos)**: `src/modules/mcp/types.ts`, `src/modules/mcp/manager.ts`, `src/modules/mcp/controller.ts`, `src/modules/mcp/routes.ts`, `src/modules/mcp/manager.test.ts`. [2026-09-16]

- **Added**: `enabledTools` option support in WebSocket chat protocol (`ws.ts`) and autonomous agent loop (`loop.ts`). Dynamically filters tool schemas and skips tool definitions when tools are disabled, preventing unwanted tool execution. [2026-09-16]
  * **Files (Archivos)**: `src/agent/types.ts`, `src/agent/loop.ts`, `src/ws.ts`. [2026-09-16]

- **Added**: Context window budget management and history trimming in `prompt.ts`. Trims older message history to prevent context overflow errors (e.g. 400 Bad Request / 349k tokens). [2026-09-16]
  * **Files (Archivos)**: `src/agent/prompt.ts`, `src/agent/prompt.test.ts`. [2026-09-16]

- **Added**: Output truncation (max 8KB / 200 lines) and directory exclusion filters (`node_modules`, `.git`, `dist`, `build`, etc.) for `read_file`, `bash`, `glob_search`, and `grep_search` tools. [2026-09-16]
  * **Files (Archivos)**: `src/tools/index.ts`. [2026-09-16]

- **Fixed**: LLMClient baseURL normalization ensuring `/v1` suffix is present and improving OpenAI-compatible error formatting. [2026-09-16]
  * **Files (Archivos)**: `src/agent/llm-client.ts`, `src/agent/llm-client.test.ts`. [2026-09-16]

- **Added**: Core engine-agent microservice architecture:
  * Autonomous iterative agent loop (`src/agent/loop.ts`) with multi-step tool execution.
  * SQLite session and persistent memory store (`src/sessions/store.ts`, `src/db/index.ts`).
  * Tool Registry (`src/tools/registry.ts`) and built-in tools (bash, file-ops, search, memory).
  * Real-time WebSocket streaming server (`src/ws.ts`) and Express REST API (`src/server.ts`, `src/routes/index.ts`). [2026-09-16]
