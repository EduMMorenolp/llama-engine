import { describe, expect, it } from "vitest";
import { demultiplexLogs } from "../src/runtime/manager.js";

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

function uint32(n: number): Buffer {
	const b = Buffer.alloc(4);
	b.writeUInt32BE(n, 0);
	return b;
}