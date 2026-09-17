import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { type WebSocket, WebSocketServer } from "ws";
import type { AgentLoopConfig } from "./agent/loop.js";
import { runAgent } from "./agent/loop.js";
import type { SessionStore } from "./sessions/store.js";

export function createWebSocketServer(
	httpServer: Server,
	store: SessionStore,
	agentConfig: AgentLoopConfig,
) {
	const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

	wss.on("connection", (ws: WebSocket) => {
		console.log("[ws] client connected");

		ws.on("message", async (data) => {
			try {
				const msg = JSON.parse(data.toString());
				if (msg.type === "chat") {
					const {
						sessionId: inputSessionId,
						message,
						model,
						systemPrompt,
						enabledTools,
						modelSettings,
					} = msg.payload ?? {};
					const sessionId = inputSessionId ?? randomUUID();

					let existingSession = store.getSession(sessionId);
					if (!existingSession) {
						const cleanMsg = typeof message === "string" ? message.trim() : "";
						const autoName = cleanMsg
							? cleanMsg.length > 35
								? `${cleanMsg.slice(0, 35)}...`
								: cleanMsg
							: "Nuevo Chat";
						existingSession = store.createSession(sessionId, autoName, model);
					} else if (!existingSession.name || existingSession.name === "Nuevo Chat") {
						const cleanMsg = typeof message === "string" ? message.trim() : "";
						if (cleanMsg) {
							const autoName =
								cleanMsg.length > 35 ? `${cleanMsg.slice(0, 35)}...` : cleanMsg;
							store.updateSession(sessionId, { name: autoName });
						}
					}

					await runAgent(
						{ ...agentConfig, store },
						{ sessionId, message, model, systemPrompt, enabledTools, modelSettings },
						(event) => {
							ws.send(JSON.stringify(event));
						},
					);
				}
			} catch (err: any) {
				const errMsg = err.message || "Error al procesar mensaje";
				try {
					const parsed = JSON.parse(data.toString());
					const sessId = parsed?.payload?.sessionId;
					if (sessId && store.getSession(sessId)) {
						store.addMessage(randomUUID(), sessId, "assistant", `⚠️ **Aviso**: ${errMsg}`);
					}
				} catch {}
				ws.send(JSON.stringify({ type: "error", payload: { message: errMsg } }));
			}
		});

		ws.on("close", () => {
			console.log("[ws] client disconnected");
		});
	});

	return wss;
}
