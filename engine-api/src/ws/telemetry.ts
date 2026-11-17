import { createHash, timingSafeEqual } from "node:crypto";
import type { Server as HttpServer, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { AppConfig } from "../config.js";
import { sanitizeRuntimeEnv } from "../main.js";
import type { RuntimeManager } from "../runtime/manager.js";
import type { EngineStatus, InferencePulse, StatusService } from "../status/index.js";

const WS_MAGIC_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

interface WsClient {
	id: string;
	socket: Duplex;
	intervalMs: number;
	paused: boolean;
	lastSentAt: number;
}

export interface TelemetrySnapshotMessage {
	type: "telemetry";
	status: EngineStatus;
	health: {
		running: boolean;
		healthy: boolean;
		loadedModel?: string;
		ctxSize?: number;
	};
	config: {
		engine: {
			port: number;
			runtimeUrl: string;
			runtimeContainer: string;
			modelsDir: string;
			rateLimit: { enabled: boolean; windowMs: number; max: number };
		};
		runtimeEnv: Record<string, string>;
	};
}

export interface InferencePulseMessage {
	type: "pulse";
	pulse: InferencePulse;
}

/**
 * Codifica un string UTF-8 como un frame de texto WebSocket (RFC 6455, opcode 0x81, sin máscara de servidor).
 */
export function encodeWsTextFrame(payload: string): Buffer {
	const data = Buffer.from(payload, "utf8");
	const len = data.length;

	if (len < 126) {
		const header = Buffer.alloc(2);
		header[0] = 0x81; // FIN + text frame
		header[1] = len;
		return Buffer.concat([header, data]);
	}
	if (len < 65_536) {
		const header = Buffer.alloc(4);
		header[0] = 0x81;
		header[1] = 126;
		header.writeUInt16BE(len, 2);
		return Buffer.concat([header, data]);
	}
	const header = Buffer.alloc(10);
	header[0] = 0x81;
	header[1] = 127;
	header.writeBigUInt64BE(BigInt(len), 2);
	return Buffer.concat([header, data]);
}

/**
 * Decodifica frames entrantes de un cliente WebSocket (enmascarados según RFC 6455).
 * Devuelve los mensajes de texto extraídos y si hubo cierre (opcode 0x8) o ping (0x9).
 */
export function decodeWsClientFrames(buf: Buffer): {
	messages: string[];
	closed: boolean;
	pingPayloads: Buffer[];
} {
	const messages: string[] = [];
	const pingPayloads: Buffer[] = [];
	let closed = false;
	let offset = 0;

	while (offset + 2 <= buf.length) {
		const byte0 = buf[offset];
		const byte1 = buf[offset + 1];
		const opcode = byte0 & 0x0f;
		const isMasked = (byte1 & 0x80) !== 0;
		let payloadLen = byte1 & 0x7f;
		let headerLen = 2;

		if (payloadLen === 126) {
			if (offset + 4 > buf.length) break;
			payloadLen = buf.readUInt16BE(offset + 2);
			headerLen = 4;
		} else if (payloadLen === 127) {
			if (offset + 10 > buf.length) break;
			payloadLen = Number(buf.readBigUInt64BE(offset + 2));
			headerLen = 10;
		}

		const maskLen = isMasked ? 4 : 0;
		const frameTotal = headerLen + maskLen + payloadLen;
		if (offset + frameTotal > buf.length) break;

		const payloadStart = offset + headerLen + maskLen;
		const rawPayload = Buffer.from(buf.subarray(payloadStart, payloadStart + payloadLen));

		if (isMasked) {
			const mask = buf.subarray(offset + headerLen, offset + headerLen + 4);
			for (let i = 0; i < rawPayload.length; i++) {
				rawPayload[i] ^= mask[i & 3];
			}
		}

		if (opcode === 0x8) {
			closed = true;
			break;
		}
		if (opcode === 0x9) {
			pingPayloads.push(rawPayload);
		} else if (opcode === 0x1) {
			messages.push(rawPayload.toString("utf8"));
		}

		offset += frameTotal;
	}

	return { messages, closed, pingPayloads };
}

function buildPongFrame(payload: Buffer): Buffer {
	const len = Math.min(125, payload.length);
	const header = Buffer.from([0x8a, len]);
	return Buffer.concat([header, payload.subarray(0, len)]);
}

function verifyApiKey(expectedKey: string, candidate: string): boolean {
	const a = Buffer.from(expectedKey);
	const b = Buffer.from(candidate);
	if (a.length === 0 || a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

/**
 * Hub WebSocket en `/api/ws` para telemetría en tiempo real:
 * - Solo ejecuta el colector de GPU/Slots cuando hay >=1 cliente activo.
 * - Transmite snapshots completos (`type: "telemetry"`) y pulsos de inferencia (`type: "pulse"`).
 * - Acepta comandos del cliente: `{ type: "set_interval", pollMs }`, `{ type: "pause", paused }`, `{ type: "refresh" }`.
 */
export class TelemetryWsHub {
	private readonly clients = new Map<string, WsClient>();
	private ticker: NodeJS.Timeout | null = null;
	private collecting = false;
	private lastPulseBroadcastAt = 0;

	constructor(
		private readonly config: AppConfig,
		private readonly runtime: RuntimeManager,
		private readonly status: StatusService,
	) {
		this.status.onPulse((pulse) => {
			const now = Date.now();
			// Throttle de pulsos en vivo a máx ~4 por segundo (cada 250ms) para fluidez sin saturar
			if (now - this.lastPulseBroadcastAt < 250) return;
			this.lastPulseBroadcastAt = now;
			this.broadcastJson({ type: "pulse", pulse } satisfies InferencePulseMessage);
		});
	}

	attach(server: HttpServer): void {
		server.on("upgrade", (req: IncomingMessage, socket: Duplex, _head: Buffer) => {
			try {
				const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
				if (url.pathname !== "/api/ws") {
					socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
					socket.destroy();
					return;
				}

				const keyFromQuery = url.searchParams.get("apiKey") ?? "";
				const keyFromHeader =
					(req.headers["x-api-key"] as string | undefined) ??
					req.headers.authorization?.replace(/^Bearer\s+/i, "") ??
					"";
				const candidateKey = keyFromQuery || keyFromHeader;

				if (!verifyApiKey(this.config.apiKey, candidateKey)) {
					socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
					socket.destroy();
					return;
				}

				const secKey = req.headers["sec-websocket-key"];
				if (!secKey || typeof secKey !== "string") {
					socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
					socket.destroy();
					return;
				}

				const acceptHash = createHash("sha1")
					.update(secKey + WS_MAGIC_GUID)
					.digest("base64");

				const responseHeaders = [
					"HTTP/1.1 101 Switching Protocols",
					"Upgrade: websocket",
					"Connection: Upgrade",
					`Sec-WebSocket-Accept: ${acceptHash}`,
					"\r\n",
				].join("\r\n");

				socket.write(responseHeaders);

				const initialInterval = clampInterval(Number(url.searchParams.get("pollMs") ?? 3000));
				const clientId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
				const client: WsClient = {
					id: clientId,
					socket,
					intervalMs: initialInterval,
					paused: false,
					lastSentAt: 0,
				};

				this.clients.set(clientId, client);
				this.ensureTicker();

				// Enviar snapshot inicial inmediatamente al conectar
				void this.sendSnapshotToClient(client);

				socket.on("data", (chunk: Buffer) => {
					const { messages, closed, pingPayloads } = decodeWsClientFrames(chunk);
					if (closed) {
						this.removeClient(clientId);
						socket.end();
						return;
					}
					for (const ping of pingPayloads) {
						try {
							socket.write(buildPongFrame(ping));
						} catch {}
					}
					for (const rawMsg of messages) {
						this.handleClientMessage(client, rawMsg);
					}
				});

				socket.on("close", () => this.removeClient(clientId));
				socket.on("error", () => this.removeClient(clientId));
			} catch {
				try {
					socket.destroy();
				} catch {}
			}
		});
	}

	private handleClientMessage(client: WsClient, raw: string): void {
		try {
			const msg = JSON.parse(raw) as {
				type?: string;
				pollMs?: number;
				paused?: boolean;
			};
			if (msg.type === "set_interval" && typeof msg.pollMs === "number") {
				client.intervalMs = clampInterval(msg.pollMs);
				this.ensureTicker();
			} else if (msg.type === "pause" && typeof msg.paused === "boolean") {
				client.paused = msg.paused;
				if (!client.paused) {
					void this.sendSnapshotToClient(client);
				}
			} else if (msg.type === "refresh") {
				void this.broadcastSnapshotNow();
			}
		} catch {
			// Ignore malformed client message
		}
	}

	private removeClient(id: string): void {
		this.clients.delete(id);
		if (this.clients.size === 0 && this.ticker) {
			clearInterval(this.ticker);
			this.ticker = null;
		}
	}

	private ensureTicker(): void {
		if (this.clients.size === 0) {
			if (this.ticker) {
				clearInterval(this.ticker);
				this.ticker = null;
			}
			return;
		}
		if (this.ticker) return;

		// Ticker maestro cada 1000ms que chequea si algún cliente necesita actualización
		this.ticker = setInterval(() => {
			void this.tick();
		}, 1000);
	}

	private async tick(): Promise<void> {
		if (this.collecting || this.clients.size === 0) return;
		const now = Date.now();
		const dueClients = [...this.clients.values()].filter(
			(c) => !c.paused && now - c.lastSentAt >= c.intervalMs - 150,
		);
		if (dueClients.length === 0) return;

		this.collecting = true;
		try {
			const snapshot = await this.collectSnapshot();
			const frame = encodeWsTextFrame(JSON.stringify(snapshot));
			const sentAt = Date.now();
			for (const client of dueClients) {
				try {
					client.socket.write(frame);
					client.lastSentAt = sentAt;
				} catch {
					this.removeClient(client.id);
				}
			}
		} catch {
			// Ignore transient collection error
		} finally {
			this.collecting = false;
		}
	}

	async broadcastSnapshotNow(): Promise<void> {
		if (this.clients.size === 0) return;
		try {
			const snapshot = await this.collectSnapshot();
			this.broadcastJson(snapshot);
		} catch {}
	}

	private async sendSnapshotToClient(client: WsClient): Promise<void> {
		try {
			const snapshot = await this.collectSnapshot();
			client.socket.write(encodeWsTextFrame(JSON.stringify(snapshot)));
			client.lastSentAt = Date.now();
		} catch {}
	}

	private broadcastJson(payload: unknown): void {
		if (this.clients.size === 0) return;
		const frame = encodeWsTextFrame(JSON.stringify(payload));
		const now = Date.now();
		for (const client of this.clients.values()) {
			if (client.paused) continue;
			try {
				client.socket.write(frame);
				if ((payload as { type?: string })?.type === "telemetry") {
					client.lastSentAt = now;
				}
			} catch {
				this.removeClient(client.id);
			}
		}
	}

	private async collectSnapshot(): Promise<TelemetrySnapshotMessage> {
		const [statusData, rawEnv] = await Promise.all([this.status.status(), this.runtime.getEnv()]);
		const runtimeEnv = sanitizeRuntimeEnv(rawEnv);
		return {
			type: "telemetry",
			status: statusData,
			health: {
				running: statusData.runtimeRunning,
				healthy: statusData.runtimeHealthy,
				loadedModel: statusData.loadedModel,
				ctxSize: statusData.ctxSize,
			},
			config: {
				engine: {
					port: this.config.port,
					runtimeUrl: this.config.runtimeUrl,
					runtimeContainer: this.config.runtimeContainer,
					modelsDir: this.config.modelsDir,
					rateLimit: this.config.rateLimit,
				},
				runtimeEnv,
			},
		};
	}
}

function clampInterval(ms: number): number {
	if (!Number.isFinite(ms)) return 3000;
	return Math.max(1000, Math.min(30_000, Math.floor(ms)));
}
