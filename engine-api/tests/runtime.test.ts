import { describe, expect, it } from "vitest";
import { sanitizeRuntimeEnv } from "../src/main.js";
import { demultiplexLogs, mergeContainerEnv } from "../src/runtime/manager.js";

describe("demultiplexLogs", () => {
	it("demultiplexa frames stdout y stderr (frame type ignorado)", () => {
		// frame: byte0=1(stdout), bytes1..3=0, bytes4..7=len(5), payload "hello"
		const stdout = Buffer.concat([Buffer.from([1, 0, 0, 0]), uint32(5), Buffer.from("hello")]);
		// frame: byte0=2(stderr), payload "err1"
		const stderr = Buffer.concat([Buffer.from([2, 0, 0, 0]), uint32(4), Buffer.from("err1")]);
		expect(demultiplexLogs([stdout, stderr])).toBe("helloerr1");
	});

	it("funciona cuando los chunks cruzan los límites de frame", () => {
		const a = Buffer.concat([Buffer.from([1, 0, 0, 0]), uint32(10), Buffer.from("0123456789")]);
		// partir el buffer por la mitad: "01234" | "56789"
		expect(demultiplexLogs([a.subarray(0, 8), a.subarray(8, 13), a.subarray(13)])).toBe("0123456789");
	});

	it("omite el frame final truncado (sin payload completo)", () => {
		const complete = Buffer.concat([Buffer.from([1, 0, 0, 0]), uint32(4), Buffer.from("hell")]);
		const truncated = Buffer.concat([Buffer.from([1, 0, 0, 0]), uint32(20)]); // declara 20, sin payload
		expect(demultiplexLogs([Buffer.concat([complete, truncated])])).toBe("hell");
	});

	it("devuelve string vacío para entrada vacía", () => {
		expect(demultiplexLogs([])).toBe("");
	});
});

describe("mergeContainerEnv", () => {
	it("actualiza LLAMA_MODEL y agrega flags avanzados de KV cache y atención", () => {
		const initial = ["PATH=/usr/bin", "LLAMA_MODEL=old-model", "LLAMA_CTX_SIZE=8192"];
		const next = mergeContainerEnv(initial, "qwen3.5-4b", {
			ctxSize: 32768,
			cacheTypeK: "q8_0",
			cacheTypeV: "q4_0",
			parallel: 2,
			flashAttn: "on",
		});
		expect(next).toContain("LLAMA_MODEL=qwen3.5-4b");
		expect(next).toContain("LLAMA_CTX_SIZE=32768");
		expect(next).toContain("LLAMA_CACHE_TYPE_K=q8_0");
		expect(next).toContain("LLAMA_CACHE_TYPE_V=q4_0");
		expect(next).toContain("LLAMA_PARALLEL=2");
		expect(next).toContain("LLAMA_FLASH_ATTN=on");
		expect(next).toContain("PATH=/usr/bin");
	});

	it("inserta LLAMA_MODEL si no existía previamente", () => {
		const next = mergeContainerEnv(["FOO=bar"], "gemma4-4b");
		expect(next).toEqual(["FOO=bar", "LLAMA_MODEL=gemma4-4b"]);
	});
});

describe("sanitizeRuntimeEnv", () => {
	it("expone solo variables LLAMA_* sin secretos", () => {
		const clean = sanitizeRuntimeEnv({
			LLAMA_MODEL: "qwen3.5-4b",
			LLAMA_CTX_SIZE: "16384",
			LLAMA_API_KEY: "top-secret",
			API_KEY: "secret",
			PATH: "/bin",
		});
		expect(clean).toEqual({
			LLAMA_MODEL: "qwen3.5-4b",
			LLAMA_CTX_SIZE: "16384",
		});
	});
});

function uint32(n: number): Buffer {
	const b = Buffer.alloc(4);
	b.writeUInt32BE(n, 0);
	return b;
}