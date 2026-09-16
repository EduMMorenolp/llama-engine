import { spawn } from "node:child_process";
import Docker from "dockerode";
import type { AppConfig } from "../config.js";
import type { RegisteredModel } from "../models/registry.js";

/**
 * Gestión del contenedor llama-runtime vía Dockerode (usa el docker.sock montado).
 * Permite start/stop/reload y consultar el estado del runtime al cargar un modelo.
 */
export class RuntimeManager {
	private readonly docker: Docker;

	constructor(private readonly config: AppConfig) {
		this.docker = new Docker();
	}

	async getContainer() {
		return this.docker.getContainer(this.config.runtimeContainer).inspect();
	}

	async isRunning(): Promise<boolean> {
		try {
			const info = await this.getContainer();
			return info.State?.Running === true;
		} catch {
			return false; // contenedor no existe o docker.sock indisponible
		}
	}

	/**
	 * Recarga el runtime apuntando a otro modelo (o flags).
	 * Estrategia simple: reinicia el contenedor; el entrypoint lee las env nuevas.
	 * `env` = variables a actualizar en el contenedor (ej. LLAMA_MODEL, LLAMA_CTX_SIZE).
	 */
	async reload(
		modelId: string,
		opts: { ctxSize?: number } = {},
	): Promise<{ ok: boolean; message: string }> {
		try {
			const container = this.docker.getContainer(this.config.runtimeContainer);
			const info = await container.inspect();
			const nextEnv = (info.Config?.Env ?? []).map((kv) => {
				const [k] = kv.split("=");
				if (k === "LLAMA_MODEL") return `LLAMA_MODEL=${modelId}`;
				if (k === "LLAMA_CTX_SIZE" && opts.ctxSize) return `LLAMA_CTX_SIZE=${opts.ctxSize}`;
				return kv;
			});
			if (!nextEnv.some((kv) => kv.startsWith("LLAMA_MODEL="))) {
				nextEnv.push(`LLAMA_MODEL=${modelId}`);
			}
			if (info.State?.Running) {
				await container.stop();
			}
			await container.remove({ force: true });
			await this.docker.createContainer({
				...info.Config,
				name: this.config.runtimeContainer,
				HostConfig: info.HostConfig,
				Env: nextEnv,
			});
			await this.docker.getContainer(this.config.runtimeContainer).start();
			return { ok: true, message: `Runtime recargado con modelo "${modelId}".` };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return { ok: false, message: msg };
		}
	}

	async restart(): Promise<{ ok: boolean; message: string }> {
		try {
			await this.docker.getContainer(this.config.runtimeContainer).restart();
			return { ok: true, message: "Runtime reiniciado." };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return { ok: false, message: msg };
		}
	}

	/** Detiene el contenedor runtime. Ya detenido => ok (no es error). */
	async stop(): Promise<{ ok: boolean; message: string }> {
		try {
			await this.docker.getContainer(this.config.runtimeContainer).stop();
			return { ok: true, message: "Runtime detenido." };
		} catch (err) {
			// status 304 = "already stopped" (docker no-modificado)
			if ((err as { statusCode?: number })?.statusCode === 304) {
				return { ok: true, message: "Runtime ya estaba detenido." };
			}
			const msg = err instanceof Error ? err.message : String(err);
			return { ok: false, message: msg };
		}
	}

	/** Inicia el contenedor runtime. Si ya corre => error. */
	async start(): Promise<{ ok: boolean; message: string }> {
		try {
			const container = this.docker.getContainer(this.config.runtimeContainer);
			const info = await container.inspect();
			if (info.State?.Running) {
				return { ok: false, message: "Runtime ya está corriendo." };
			}
			await container.start();
			return { ok: true, message: "Runtime iniciado." };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return { ok: false, message: msg };
		}
	}

	/**
	 * Últimas líneas de logs del contenedor (stdout+stderr), demultiplexadas
	 * del protocolo Docker (8 bytes de cabecera por frame; bytes 4..7 = tamaño).
	 * `tail` se limita a 1..500.
	 */
	async logs(tail: number): Promise<string> {
		const n = Math.max(1, Math.min(500, Number.isFinite(tail) ? Math.floor(tail) : 100));
		try {
			const container = this.docker.getContainer(this.config.runtimeContainer);
			// Sin follow, dockerode devuelve un Buffer multiplexado ya completo.
			const buf = await container.logs({ stdout: true, stderr: true, tail: n });
			return demultiplexLogs([buf]);
		} catch {
			return "";
		}
	}

	/** Variables de entorno del contenedor como objeto clave-valor. `{}` si falla. */
	async getEnv(): Promise<Record<string, string>> {
		try {
			const info = await this.getContainer();
			const env = info.Config?.Env;
			if (!Array.isArray(env)) return {};
			const out: Record<string, string> = {};
			for (const kv of env) {
				const idx = kv.indexOf("=");
				if (idx <= 0) continue;
				out[kv.slice(0, idx)] = kv.slice(idx + 1);
			}
			return out;
		} catch {
			return {};
		}
	}

	/**
	 * Ejecuta un comando dentro del contenedor runtime vía dockerode (usa docker.sock).
	 * Útil para telemetría GPU (nvidia-smi vive en el runtime, que sí tiene drivers).
	 */
	async exec(cmd: string, timeoutMs = 5000): Promise<string> {
		try {
			const container = this.docker.getContainer(this.config.runtimeContainer);
			const exec = await container.exec({
				Cmd: ["sh", "-lc", cmd],
				AttachStdout: true,
				AttachStderr: true,
			});
			const stream = await exec.start({ hijack: false, stdin: false });
			return await collectExecOutput(stream, timeoutMs);
		} catch {
			return await hostExec(cmd, timeoutMs);
		}
	}
}

function collectExecOutput(stream: NodeJS.ReadableStream, timeoutMs: number): Promise<string> {
	return new Promise((resolve) => {
		let out = "";
		const timer = setTimeout(() => resolve(out), timeoutMs);
		const done = () => {
			clearTimeout(timer);
			resolve(out);
		};
		stream.on("data", (chunk: Buffer) => (out += chunk.toString()));
		stream.on("end", done);
		stream.on("error", done);
	});
}

function hostExec(cmd: string, timeoutMs: number): Promise<string> {
	return new Promise((resolve) => {
		let out = "";
		const parts = cmd.split(" ");
		const child = spawn(parts[0], parts.slice(1), { encoding: "utf8" } as never);
		child.stdout?.on("data", (d: Buffer) => (out += d.toString()));
		child.stderr?.on("data", () => {});
		child.on("error", () => resolve(""));
		child.on("close", () => resolve(out));
		setTimeout(() => {
			try {
				child.kill();
			} catch {}
		}, timeoutMs);
	});
}

export type { RegisteredModel }; // re-export para conveniencia

/**
 * Demultiplexa el buffer de logs de Docker (modo multiplexado).
 * Cada frame: byte 0 = stream type (1=stdout, 2=stderr), bytes 1..3 padding,
 * bytes 4..7 = largo (big-endian), luego el payload. Se ignoran los tipos y
 * se concatenan los payloads.
 */
export function demultiplexLogs(chunks: Buffer[]): string {
	const data = Buffer.concat(chunks);
	let out = "";
	let offset = 0;
	while (offset + 8 <= data.length) {
		const frameLen = data.readUInt32BE(offset + 4);
		const end = offset + 8 + frameLen;
		if (end > data.length) break;
		out += data.subarray(offset + 8, end).toString("utf8");
		offset = end;
	}
	return out;
}
