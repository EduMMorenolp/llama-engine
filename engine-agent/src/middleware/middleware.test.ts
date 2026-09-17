import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	BadRequestException,
	UnauthorizedException,
	ForbiddenException,
	NotFoundException,
	ConflictException,
} from "../common/exceptions/http-exception.js";
import { createAuthMiddleware } from "./auth.js";
import { ValidationPipe } from "./validation.js";
import { errorHandler } from "./errorHandler.js";

const mockGetConfig = vi.fn().mockReturnValue({ NODE_ENV: "test" });
vi.mock("../config/index.js", () => ({ getConfig: (...args: any[]) => mockGetConfig(...args) }));

function mockReq(headers: Record<string, string> = {}) {
	return { headers } as any;
}

function mockRes() {
	const res: any = {};
	res.status = vi.fn().mockReturnValue(res);
	res.json = vi.fn().mockReturnValue(res);
	return res;
}

describe("HttpExceptions", () => {
	it("BadRequestException has statusCode 400", () => {
		const err = new BadRequestException("bad");
		expect(err.statusCode).toBe(400);
		expect(err.message).toBe("bad");
		expect(err.name).toBe("BadRequestException");
	});

	it("UnauthorizedException has statusCode 401", () => {
		const err = new UnauthorizedException("unauth");
		expect(err.statusCode).toBe(401);
		expect(err.name).toBe("UnauthorizedException");
	});

	it("ForbiddenException has statusCode 403", () => {
		const err = new ForbiddenException("forbidden");
		expect(err.statusCode).toBe(403);
	});

	it("NotFoundException has statusCode 404", () => {
		const err = new NotFoundException("not found");
		expect(err.statusCode).toBe(404);
	});

	it("ConflictException has statusCode 409", () => {
		const err = new ConflictException("conflict");
		expect(err.statusCode).toBe(409);
	});

	it("all extend HttpException", () => {
		expect(new BadRequestException("x")).toBeInstanceOf(Error);
		expect(new UnauthorizedException("x")).toBeInstanceOf(Error);
		expect(new ForbiddenException("x")).toBeInstanceOf(Error);
		expect(new NotFoundException("x")).toBeInstanceOf(Error);
		expect(new ConflictException("x")).toBeInstanceOf(Error);
	});
});

describe("createAuthMiddleware", () => {
	it("calls next when API key matches via x-api-key header", () => {
		const middleware = createAuthMiddleware("secret-key");
		const req = mockReq({ "x-api-key": "secret-key" });
		const res = mockRes();
		const next = vi.fn();
		middleware(req, res, next);
		expect(next).toHaveBeenCalled();
	});

	it("calls next when API key matches via Bearer token", () => {
		const middleware = createAuthMiddleware("secret-key");
		const req = mockReq({ authorization: "Bearer secret-key" });
		const res = mockRes();
		const next = vi.fn();
		middleware(req, res, next);
		expect(next).toHaveBeenCalled();
	});

	it("throws UnauthorizedException when key is missing", () => {
		const middleware = createAuthMiddleware("secret-key");
		const req = mockReq({});
		const res = mockRes();
		const next = vi.fn();
		expect(() => middleware(req, res, next)).toThrow(UnauthorizedException);
	});

	it("throws UnauthorizedException when key is wrong", () => {
		const middleware = createAuthMiddleware("secret-key");
		const req = mockReq({ "x-api-key": "wrong-key" });
		const res = mockRes();
		const next = vi.fn();
		expect(() => middleware(req, res, next)).toThrow("API key inválida o requerida");
	});

	it("prefers x-api-key over Bearer token", () => {
		const middleware = createAuthMiddleware("correct");
		const req = mockReq({ "x-api-key": "correct", authorization: "Bearer wrong" });
		const res = mockRes();
		const next = vi.fn();
		middleware(req, res, next);
		expect(next).toHaveBeenCalled();
	});
});

describe("ValidationPipe", () => {
	it("calls next and sets req.body when validation passes", () => {
		const schema = z.object({ name: z.string().min(1) });
		const pipe = ValidationPipe(schema);
		const req = { body: { name: "test" } } as any;
		const res = mockRes();
		const next = vi.fn();
		pipe(req, res, next);
		expect(next).toHaveBeenCalled();
		expect(req.body).toEqual({ name: "test" });
	});

	it("throws BadRequestException when validation fails", () => {
		const schema = z.object({ name: z.string().min(1) });
		const pipe = ValidationPipe(schema);
		const req = { body: { name: "" } } as any;
		const res = mockRes();
		const next = vi.fn();
		expect(() => pipe(req, res, next)).toThrow(BadRequestException);
	});

	it("includes field path in error message", () => {
		const schema = z.object({ name: z.string().min(1) });
		const pipe = ValidationPipe(schema);
		const req = { body: { name: "" } } as any;
		const res = mockRes();
		const next = vi.fn();
		try {
			pipe(req, res, next);
		} catch (err: any) {
			expect(err.message).toContain("name");
		}
	});

	it("applies defaults from schema", () => {
		const schema = z.object({ tags: z.array(z.string()).default([]) });
		const pipe = ValidationPipe(schema);
		const req = { body: {} } as any;
		const res = mockRes();
		const next = vi.fn();
		pipe(req, res, next);
		expect(req.body.tags).toEqual([]);
	});
});

describe("errorHandler", () => {
	it("returns statusCode and message for HttpException", () => {
		const err = new BadRequestException("invalid input");
		const req = {} as any;
		const res = mockRes();
		const next = vi.fn();
		errorHandler(err, req, res, next);
		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({ error: "invalid input" });
	});

	it("returns 500 for generic errors", () => {
		const err = new Error("something broke");
		const req = {} as any;
		const res = mockRes();
		const next = vi.fn();
		errorHandler(err, req, res, next);
		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({ error: "Error interno del servidor" }),
		);
	});

	it("includes stack in development mode", () => {
		mockGetConfig.mockReturnValue({ NODE_ENV: "development" });
		const err = new Error("test");
		const req = {} as any;
		const res = mockRes();
		const next = vi.fn();
		errorHandler(err, req, res, next);
		const call = res.json.mock.calls[0][0];
		expect(call.stack).toBeDefined();
	});

	it("hides stack in production mode", () => {
		mockGetConfig.mockReturnValue({ NODE_ENV: "production" });
		const err = new Error("test");
		const req = {} as any;
		const res = mockRes();
		const next = vi.fn();
		errorHandler(err, req, res, next);
		const call = res.json.mock.calls[0][0];
		expect(call.stack).toBeUndefined();
	});
});
