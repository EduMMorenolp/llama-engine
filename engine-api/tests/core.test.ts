import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createAuthMiddleware } from "../src/middleware/auth.js";
import { ModelRegistry } from "../src/models/registry.js";
import { stripUpstreamCredentials } from "../src/proxy/v1.js";
import { buildConfig } from "../src/config.js";
import type { Env } from "../src/env.js";

const dirs: string[] = [];

function tempDir(): string {
	const d = mkdtempSync(join(tmpdir(), "llama-engine-"));
	dirs.push(d);
	return d;
}

afterEach(() => {
	for (const d of dirs) {
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
		RATE_LIMIT_WINDOW_MS: 900_000,
		RATE_LIMIT_MAX: 1000,
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

	it("no registra los mmproj como modelos", () => {
		const dir = tempDir();
		writeFileSync(join(dir, "mmproj-foo.gguf"), "x");
		const reg = new ModelRegistry(makeConfig({ MODELS_DIR: dir }));
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
