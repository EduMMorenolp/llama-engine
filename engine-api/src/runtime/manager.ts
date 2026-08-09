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
