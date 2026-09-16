# API Contracts — engine-agent

Contratos de API para el agent engine. Fuente de la verdad antes de implementar.

## Base URL

```
http://localhost:3060
```

## Autenticación

Todos los endpoints (excepto `/api/health`) requieren API key via:
- Header: `X-API-Key: <key>`
- Header: `Authorization: Bearer <key>`

La API key es la misma que `ENGINE_API_KEY` del proyecto.

---

## Endpoints

### GET /api/health

Health check público.

**Response 200:**
```json
{
  "status": "ok",
  "agentRunning": true
}
```

---

### POST /api/chat

Enviar mensaje y recibir respuesta streaming vía SSE.

**Request:**
```json
{
  "sessionId": "abc123",    // opcional, crea sesión si se omite
  "message": "Hola",
  "model": "qwen3.5-4b"    // opcional, usa modelo actual si se omite
}
```

**Response 200 (SSE):**
```
data: {"type":"message","payload":{"role":"assistant","content":"Hola"}}
data: {"type":"message","payload":{"role":"assistant","content":" ¿En qué"}}
data: {"type":"tool_start","payload":{"name":"bash","args":{"command":"ls"}}}
data: {"type":"tool_end","payload":{"name":"bash","result":"file1.txt\nfile2.txt"}}
data: {"type":"message","payload":{"role":"assistant","content":"¿En qué puedo ayudarte?"}}
data: {"type":"done","payload":{"messageId":"msg_abc123"}}
```

**Eventos SSE:**
| type | Payload | Descripción |
|------|---------|-------------|
| `message` | `{ role, content }` | Chunk de texto del asistente |
| `tool_start` | `{ name, args }` | Inicio de ejecución de tool |
| `tool_end` | `{ name, result }` | Fin de ejecución de tool |
| `done` | `{ messageId }` | Respuesta completa |
| `error` | `{ message }` | Error durante la ejecución |

**Response 401:**
```json
{
  "error": "API key requerida"
}
```

---

### GET /api/sessions

Listar todas las sesiones.

**Response 200:**
```json
{
  "sessions": [
    {
      "id": "abc123",
      "name": "Mi sesión",
      "model": "qwen3.5-4b",
      "createdAt": 1694800000000,
      "updatedAt": 1694800000000
    }
  ]
}
```

---

### POST /api/sessions

Crear una nueva sesión.

**Request:**
```json
{
  "name": "Mi sesión",       // opcional
  "model": "qwen3.5-4b"     // opcional
}
```

**Response 201:**
```json
{
  "id": "abc123",
  "name": "Mi sesión",
  "model": "qwen3.5-4b",
  "createdAt": 1694800000000,
  "updatedAt": 1694800000000
}
```

---

### GET /api/sessions/:id

Obtener sesión con mensajes.

**Response 200:**
```json
{
  "id": "abc123",
  "name": "Mi sesión",
  "model": "qwen3.5-4b",
  "messages": [
    {
      "id": "msg_001",
      "role": "user",
      "content": "Hola",
      "toolCalls": null,
      "toolCallId": null,
      "createdAt": 1694800000000
    },
    {
      "id": "msg_002",
      "role": "assistant",
      "content": "Hola, ¿en qué puedo ayudarte?",
      "toolCalls": null,
      "toolCallId": null,
      "createdAt": 1694800001000
    }
  ],
  "createdAt": 1694800000000,
  "updatedAt": 1694800001000
}
```

**Response 404:**
```json
{
  "error": "Sesión no encontrada"
}
```

---

### DELETE /api/sessions/:id

Eliminar sesión y sus mensajes.

**Response 200:**
```json
{
  "ok": true
}
```

**Response 404:**
```json
{
  "error": "Sesión no encontrada"
}
```

---

### GET /api/tools

Listar tools disponibles (built-in + custom).

**Response 200:**
```json
{
  "tools": [
    {
      "name": "bash",
      "description": "Ejecutar comandos en el sistema",
      "parameters": {
        "type": "object",
        "properties": {
          "command": { "type": "string", "description": "Comando a ejecutar" }
        },
        "required": ["command"]
      }
    }
  ]
}
```

---

### POST /api/tools

Registrar un tool custom.

**Request:**
```json
{
  "name": "mi_tool",
  "description": "Descripción del tool",
  "parameters": {
    "type": "object",
    "properties": {
      "input": { "type": "string" }
    },
    "required": ["input"]
  },
  "handlerType": "bash",      // "bash" | "http" | "prompt"
  "handlerConfig": {
    "command": "echo {{input}}"
  }
}
```

**Response 201:**
```json
{
  "ok": true
}
```

---

### DELETE /api/tools/:name

Eliminar tool custom.

**Response 200:**
```json
{
  "ok": true
}
```

**Response 404:**
```json
{
  "error": "Tool no encontrado"
}
```

---

### GET /api/memories

Listar memorias del agente.

**Query params:**
- `q` (opcional): buscar por keyword

**Response 200:**
```json
{
  "memories": [
    {
      "id": "mem_001",
      "key": "user_name",
      "content": "El usuario se llama Eduardo",
      "tags": ["user", "name"],
      "createdAt": 1694800000000,
      "updatedAt": 1694800000000
    }
  ]
}
```

---

### POST /api/memories

Crear o actualizar memoria.

**Request:**
```json
{
  "key": "user_name",
  "content": "El usuario se llama Eduardo",
  "tags": ["user", "name"]
}
```

**Response 201:**
```json
{
  "id": "mem_001",
  "key": "user_name",
  "content": "El usuario se llama Eduardo",
  "tags": ["user", "name"],
  "createdAt": 1694800000000,
  "updatedAt": 1694800000000
}
```

---

### DELETE /api/memories/:key

Eliminar memoria por key.

**Response 200:**
```json
{
  "ok": true
}
```

---

## WebSocket

Conexión: `ws://localhost:3060/ws`

### Client → Server

```json
{
  "type": "chat",
  "payload": {
    "sessionId": "abc123",
    "message": "Hola"
  }
}
```

### Server → Client

```json
{
  "type": "message",
  "payload": {
    "role": "assistant",
    "content": "Hola"
  }
}
```

```json
{
  "type": "tool_start",
  "payload": {
    "name": "bash",
    "args": { "command": "ls" }
  }
}
```

```json
{
  "type": "tool_end",
  "payload": {
    "name": "bash",
    "result": "file1.txt\nfile2.txt"
  }
}
```

```json
{
  "type": "done",
  "payload": {
    "messageId": "msg_abc123"
  }
}
```

```json
{
  "type": "error",
  "payload": {
    "message": "Error procesando mensaje"
  }
}
```
