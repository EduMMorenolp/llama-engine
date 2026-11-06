import { randomUUID } from "node:crypto";
import { createWriteStream, existsSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { AppConfig } from "../config.js";

export interface HubModel {
	id: string;
	owner: string;
	name: string;
	downloads: number;
	likes: number;
	tags: string[];
	private: boolean;
}

export interface HubFile {
	path: string;
	size: number;
}

export interface HubRepoDetail {
	id: string;
	owner: string;
	name: string;
	downloads: number;
	likes: number;
	lastModified?: string;
	tags: string[];
	ggufFiles: HubFile[];
}

export interface HubDownloadJob {
	jobId: string;
	id: string;
	owner: string;
	name: string;
	file: string;
	status: "running" | "completed" | "failed";
	downloadedBytes: number;
	totalBytes: number;
	progress: number;
	error?: string;
	startedAt: string;
	completedAt?: string;
}

export class HubError extends Error {
	constructor(
		message: string,
		readonly status?: number,
	) {
		super(message);
	}
}

interface ApiModel {
	id?: string;
	downloads?: number;
	likes?: number;
	tags?: string[];
	private?: boolean;
	lastModified?: string;
}

interface TreeEntry {
	path?: string;
	type?: string;
	size?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const USER_AGENT = "llama-engine/0.4.0";

export class HuggingFaceHub {
	private readonly base: string;
	private readonly headers: Record<string, string>;
	private readonly downloadJobs = new Map<string, HubDownloadJob>();

	constructor(private readonly config: AppConfig) {
		this.base = config.hubUrl.replace(/\/+$/, "");
		this.headers = { "user-agent": USER_AGENT };
		if (config.hubToken) {
			this.headers.authorization = `Bearer ${config.hubToken}`;
		}
	}

	async searchModels(query: string, limit = 20): Promise<HubModel[]> {
		const url = new URL(`${this.base}/api/models`);
		if (query.trim()) url.searchParams.set("search", query.trim());
		url.searchParams.set("filter", "gguf");
		url.searchParams.set("limit", String(limit));

		const data = (await this.getJson(url)) as ApiModel[];
		const models: HubModel[] = [];
		for (const m of data) {
			if (!m.id) continue;
			const { owner, name } = splitId(m.id);
			models.push({
				id: m.id,
				owner,
				name,
				downloads: m.downloads ?? 0,
				likes: m.likes ?? 0,
				tags: m.tags ?? [],
				private: m.private ?? false,
			});
		}
		return models;
	}

	async repoDetail(owner: string, name: string): Promise<HubRepoDetail> {
		const repo = `${owner}/${name}`;
		const info = (await this.getJson(new URL(`${this.base}/api/models/${repo}`))) as ApiModel;
		const tree = (await this.getJson(
			new URL(`${this.base}/api/models/${repo}/tree/main?recursive=true`),
		)) as TreeEntry[];
		const ggufFiles = tree
			.filter((e) => e.type === "file" && e.path?.endsWith(".gguf"))
			.map((e) => ({ path: e.path ?? "", size: e.size ?? 0 }));

		return {
			id: info.id ?? repo,
			owner,
			name,
			downloads: info.downloads ?? 0,
			likes: info.likes ?? 0,
			lastModified: info.lastModified,
			tags: info.tags ?? [],
			ggufFiles,
		};
	}

	listDownloadJobs(): HubDownloadJob[] {
		return Array.from(this.downloadJobs.values());
	}

	getDownloadJob(jobId: string): HubDownloadJob | undefined {
		return this.downloadJobs.get(jobId);
	}

	startDownloadJob(owner: string, name: string, file: string): HubDownloadJob {
		const safeFile = sanitizeFile(file);
		if (!safeFile.endsWith(".gguf")) {
			throw new HubError("El archivo debe ser un .gguf", 400);
		}
		const id = safeFile.replace(/\.gguf$/, "");
		const target = join(this.config.modelsDir, `${id}.gguf`);
		if (existsSync(target)) {
			throw new HubError(`"${id}" ya existe en /models`, 409);
		}

		// Si ya hay un job activo para el mismo archivo, devolverlo
		for (const existing of this.downloadJobs.values()) {
			if (existing.id === id && existing.status === "running") {
				return existing;
			}
		}

		const jobId = randomUUID().slice(0, 8);
		const job: HubDownloadJob = {
			jobId,
			id,
			owner,
			name,
			file: safeFile,
			status: "running",
			downloadedBytes: 0,
			totalBytes: 0,
			progress: 0,
			startedAt: new Date().toISOString(),
		};
		this.downloadJobs.set(jobId, job);

		void this.runDownload(job, target);
		return job;
	}

	async downloadGGUF(
		owner: string,
		name: string,
		file: string,
	): Promise<{ id: string; sizeBytes: number }> {
		const safeFile = sanitizeFile(file);
		if (!safeFile.endsWith(".gguf")) {
			throw new HubError("El archivo debe ser un .gguf", 400);
		}
		const id = safeFile.replace(/\.gguf$/, "");
		const target = join(this.config.modelsDir, `${id}.gguf`);
		if (existsSync(target)) {
			throw new HubError(`"${id}" ya existe en /models`, 409);
		}

		const jobId = randomUUID().slice(0, 8);
		const job: HubDownloadJob = {
			jobId,
			id,
			owner,
			name,
			file: safeFile,
			status: "running",
			downloadedBytes: 0,
			totalBytes: 0,
			progress: 0,
			startedAt: new Date().toISOString(),
		};
		this.downloadJobs.set(jobId, job);

		await this.runDownload(job, target, true);
		return { id, sizeBytes: job.downloadedBytes };
	}

	private async runDownload(job: HubDownloadJob, target: string, rethrow = false): Promise<void> {
		const partPath = `${target}.part`;
		try {
			const url = new URL(`${this.base}/${job.owner}/${job.name}/resolve/main/${job.file}`);
			const res = await fetch(url, {
				headers: this.headers,
				redirect: "follow",
				signal: AbortSignal.timeout(1_800_000),
			});
			if (!res.ok || !res.body) {
				throw new HubError(`Descarga falló (${res.status})`, res.status);
			}

			const contentLength = Number(res.headers.get("content-length") ?? 0);
			if (Number.isFinite(contentLength) && contentLength > 0) {
				job.totalBytes = contentLength;
			}

			const counter = new Transform({
				transform(chunk: Buffer, _encoding, callback) {
					job.downloadedBytes += chunk.length;
					if (job.totalBytes > 0) {
						job.progress = Math.min(99, Math.round((job.downloadedBytes / job.totalBytes) * 100));
					}
					callback(null, chunk);
				},
			});

			await pipeline(Readable.fromWeb(res.body as never), counter, createWriteStream(partPath));
			renameSync(partPath, target);
			const stat = statSync(target);
			job.downloadedBytes = stat.size;
			job.totalBytes = stat.size;
			job.progress = 100;
			job.status = "completed";
			job.completedAt = new Date().toISOString();
		} catch (err) {
			try {
				if (existsSync(partPath)) unlinkSync(partPath);
			} catch {}
			job.status = "failed";
			job.error = err instanceof Error ? err.message : String(err);
			job.completedAt = new Date().toISOString();
			if (rethrow) throw err;
		}
	}

	private async getJson(url: URL): Promise<unknown> {
		const res = await fetch(url, {
			headers: this.headers,
			signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
		});
		if (!res.ok) {
			throw new HubError(`Hub respondió ${res.status}`, res.status);
		}
		return res.json();
	}
}

function splitId(id: string): { owner: string; name: string } {
	const slash = id.indexOf("/");
	if (slash <= 0) return { owner: id, name: id };
	return { owner: id.slice(0, slash), name: id.slice(slash + 1) };
}

export function sanitizeFile(file: string): string {
	const base = file.replace(/\\/g, "/").split("/").pop() ?? "";
	return base.replace(/[^a-zA-Z0-9._-]/g, "");
}
