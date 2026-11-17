import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildConfig } from "../src/config.js";
import type { Env } from "../src/env.js";
import { sanitizeFile } from "../src/hub/hf.js";
import { createAuthMiddleware } from "../src/middleware/auth.js";
import { ModelRegistry } from "../src/models/registry.js";
import { stripUpstreamCredentials } from "../src/proxy/v1.js";
import {
	deployBodySchema,
	hfDownloadBodySchema,
	quantizeBodySchema,
	reloadBodySchema,
	trainStartBodySchema,
} from "../src/schemas.js";

const dirs: string[] = [];

function tempDir(): string {
	const d = mkdtempSync(join(tmpdir(), "llama-engine-"));
	dirs.push(d);
	return d;
}

afterEach(() => {
	for (const _d of dirs) {
		dirs.length = 0;
	}
});

function makeConfig(over: Partial<Env> = {}): ReturnType<typeof buildConfig> {
	return buildConfig({
		PORT: 3050,
		API_KEY: "secret-key",
		LLAMA_RUNTIME_URL: "http://llama-runtime:8080",
		LLAMA_RUNTIME_CONTAINER: "llama-runtime",
		MODELS_DIR: "/models",
		RATE_LIMIT_ENABLED: true,
		RATE_LIMIT_WINDOW_MS: 900_000,
		RATE_LIMIT_MAX: 1000,
		HF_TOKEN: "",
		HF_HUB_URL: "https://huggingface.co",
		TRAINER_URL: "http://llama-trainer:8081",
		...over,
	});
}

function req(headers: Record<string, string | undefined>) {
	return { headers } as unknown as import("express").Request;
}

describe("auth middleware", () => {
	const config = makeConfig();
	const mw = createAuthMiddleware(config);

function run(headers: Record<string, string | undefined>): number {
	let code = 0;
	const res = { status: (c: number) => ((code = c), res), json: () => res } as unknown as import("express").Response;
	mw(req(headers), res, (() => {
		code = 200;
	}) as never);
	return code;
}

	it("acepta x-api-key correcta", () => {
		expect(run({ "x-api-key": "secret-key" })).toBe(200);
	});

	it("acepta Authorization Bearer correcto", () => {
		expect(run({ authorization: "Bearer secret-key" })).toBe(200);
	});

	it("rechaza key incorrecta", () => {
		expect(run({ "x-api-key": "wrong" })).toBe(401);
	});

	it("rechaza sin key", () => {
		expect(run({})).toBe(401);
	});
});

describe("buildConfig", () => {
	it("mapea campos desde env", () => {
		const c = makeConfig();
		expect(c.port).toBe(3050);
		expect(c.apiKey).toBe("secret-key");
		expect(c.rateLimit.max).toBe(1000);
	});
});

describe("ModelRegistry", () => {
	it("registra modelos y detecta vision por mmproj", () => {
		const dir = tempDir();
		writeFileSync(join(dir, "qwen3.5-4b.gguf"), "x");
		writeFileSync(join(dir, "mmproj-qwen3.5-4b.gguf"), "x");
		writeFileSync(join(dir, "gemma4-4b.gguf"), "x");

		const reg = new ModelRegistry(makeConfig({ MODELS_DIR: dir }));
		const models = reg.list();
		expect(models).toHaveLength(2);
		const qwen = models.find((m) => m.id === "qwen3.5-4b");
		expect(qwen?.vision).toBe(true);
		expect(qwen?.mmprojPath).toContain("mmproj-qwen3.5-4b.gguf");
		const gemma = models.find((m) => m.id === "gemma4-4b");
		expect(gemma?.vision).toBe(false);
	});

	it("no registra los mmproj como modelos pero los reporta como huérfanos", () => {
		const dir = tempDir();
		writeFileSync(join(dir, "mmproj-foo.gguf"), "x");
		const reg = new ModelRegistry(makeConfig({ MODELS_DIR: dir }));
		expect(reg.list()).toHaveLength(0);
		const orphans = reg.listOrphanMmprojs();
		expect(orphans).toHaveLength(1);
		expect(orphans[0].expectedModelId).toBe("foo");
	});

	it("guarda y asocia presets por modelo y permite eliminar un modelo", () => {
		const dir = tempDir();
		writeFileSync(join(dir, "phi-4-mini.gguf"), "abc");
		const reg = new ModelRegistry(makeConfig({ MODELS_DIR: dir }));
		reg.savePreset("phi-4-mini", {
			label: "Eco 8GB",
			ctxSize: 16384,
			cacheTypeK: "q8_0",
			cacheTypeV: "q4_0",
			parallel: 1,
		});
		const model = reg.get("phi-4-mini");
		expect(model?.preset?.ctxSize).toBe(16384);
		expect(model?.preset?.label).toBe("Eco 8GB");

		const del = reg.deleteModel("phi-4-mini");
		expect(del.deletedFiles).toContain("phi-4-mini.gguf");
		expect(reg.list()).toHaveLength(0);
	});

	it("devuelve [] si el dir no existe", () => {
		const reg = new ModelRegistry(makeConfig({ MODELS_DIR: join(tmpdir(), "no-existe-xyz") }));
		expect(reg.list()).toEqual([]);
	});
});

describe("proxy credentials", () => {
	it("quita authorization y x-api-key de los headers al upstream", () => {
		const headers = stripUpstreamCredentials({
			"content-type": "application/json",
			authorization: "Bearer client-key",
			"x-api-key": "client-key",
		});
		expect(headers).not.toHaveProperty("authorization");
		expect(headers).not.toHaveProperty("x-api-key");
		expect(headers["content-type"]).toBe("application/json");
	});
});

describe("API Zod schemas & sanitization", () => {
	it("reloadBodySchema valida modelId y opciones avanzadas", () => {
		const parsed = reloadBodySchema.safeParse({
			modelId: "qwen3.5-4b",
			ctxSize: 32768,
			cacheTypeK: "q8_0",
			cacheTypeV: "q4_0",
			parallel: 2,
			flashAttn: "on",
		});
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.modelId).toBe("qwen3.5-4b");
			expect(parsed.data.ctxSize).toBe(32768);
			expect(parsed.data.cacheTypeK).toBe("q8_0");
		}
	});

	it("reloadBodySchema rechaza path traversal en modelId", () => {
		expect(reloadBodySchema.safeParse({ modelId: "../secret" }).success).toBe(false);
		expect(reloadBodySchema.safeParse({ modelId: "" }).success).toBe(false);
	});

	it("deployBodySchema valida modelName y activate por defecto false", () => {
		const ok = deployBodySchema.safeParse({ modelName: "mi-modelo-Q4_K_M" });
		expect(ok.success).toBe(true);
		if (ok.success) {
			expect(ok.data.activate).toBe(false);
		}
		expect(deployBodySchema.safeParse({ modelName: "../../etc/passwd" }).success).toBe(false);
	});

	it("hfDownloadBodySchema valida owner, name, file y async", () => {
		const ok = hfDownloadBodySchema.safeParse({
			owner: "bartowski",
			name: "Qwen3.5-4B-GGUF",
			file: "qwen3.5-4b.gguf",
			async: true,
		});
		expect(ok.success).toBe(true);
		expect(hfDownloadBodySchema.safeParse({ owner: "a/b", name: "x", file: "y" }).success).toBe(
			false,
		);
	});

	it("trainStartBodySchema y quantizeBodySchema validan parámetros", () => {
		const trainOk = trainStartBodySchema.safeParse({
			baseModelId: "Qwen/Qwen2.5-3B",
			datasetId: "instrucciones-es",
			method: "qlora",
		});
		expect(trainOk.success).toBe(true);

		const quantOk = quantizeBodySchema.safeParse({
			modelId: "mi-modelo",
			method: "Q4_K_M",
			imatrix: true,
		});
		expect(quantOk.success).toBe(true);
		expect(
			quantizeBodySchema.safeParse({ modelId: "mi-modelo", method: "INVALID" }).success,
		).toBe(false);
	});

	it("sanitizeFile elimina directorios y caracteres peligrosos", () => {
		expect(sanitizeFile("../../models/qwen3.5-4b.gguf")).toBe("qwen3.5-4b.gguf");
		expect(sanitizeFile("subfolder\\model$name!.gguf")).toBe("modelname.gguf");
	});
});
