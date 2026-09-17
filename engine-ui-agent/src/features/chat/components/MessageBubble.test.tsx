import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "./MessageBubble.tsx";

const mockWriteText = vi.fn().mockResolvedValue(undefined);

afterEach(() => {
	vi.restoreAllMocks();
});

describe("MessageBubble", () => {
	it("renders user message with user icon", () => {
		const message = { id: "m1", sessionId: "s1", role: "user" as const, content: "Hello", toolCalls: null, toolCallId: null, createdAt: 1 };
		render(<MessageBubble message={message} />);
		expect(screen.getByText("Hello")).toBeDefined();
	});

	it("renders assistant message", () => {
		const message = { id: "m1", sessionId: "s1", role: "assistant" as const, content: "Hi there", toolCalls: null, toolCallId: null, createdAt: 1 };
		render(<MessageBubble message={message} />);
		expect(screen.getByText("Hi there")).toBeDefined();
	});

	it("renders markdown content", () => {
		const message = { id: "m1", sessionId: "s1", role: "assistant" as const, content: "**bold** and `code`", toolCalls: null, toolCallId: null, createdAt: 1 };
		render(<MessageBubble message={message} />);
		expect(screen.getByText("bold")).toBeDefined();
	});

	it("renders code blocks with syntax highlighting", () => {
		const message = {
			id: "m1",
			sessionId: "s1",
			role: "assistant" as const,
			content: "```js\nconst x = 1;\n```",
			toolCalls: null,
			toolCallId: null,
			createdAt: 1,
		};
		const { container } = render(<MessageBubble message={message} />);
		const codeBlock = container.querySelector(".code-block-wrapper");
		expect(codeBlock).not.toBeNull();
		expect(codeBlock?.textContent).toContain("const x = 1;");
	});

	it("shows thinking block when present", () => {
		const message = {
			id: "m1",
			sessionId: "s1",
			role: "assistant" as const,
			content: "<think>Let me think...</think>The answer is 42.",
			toolCalls: null,
			toolCallId: null,
			createdAt: 1,
		};
		const { container } = render(<MessageBubble message={message} />);
		const thinkingBody = container.querySelector(".thinking-body");
		expect(thinkingBody).not.toBeNull();
		expect(thinkingBody?.textContent).toContain("Let me think...");
		expect(screen.getByText(/The answer is 42/)).toBeDefined();
	});

	it("shows tool calls when provided", () => {
		const message = {
			id: "m1",
			sessionId: "s1",
			role: "assistant" as const,
			content: null,
			toolCalls: null,
			toolCallId: null,
			createdAt: 1,
		};
		const toolCalls = [
			{ id: "tc1", name: "bash", args: { command: "echo hi" }, result: "hi", status: "done" as const },
		];
		render(<MessageBubble message={message} toolCalls={toolCalls} />);
		expect(screen.getByText("bash")).toBeDefined();
	});

	it("shows copy button for assistant messages", () => {
		const message = { id: "m1", sessionId: "s1", role: "assistant" as const, content: "Copy me", toolCalls: null, toolCallId: null, createdAt: 1 };
		render(<MessageBubble message={message} />);
		expect(screen.getByTitle("Copiar mensaje")).toBeDefined();
	});

	it("calls onCopy when copy button is clicked", async () => {
		vi.stubGlobal("navigator", { clipboard: { writeText: mockWriteText } });
		const onCopy = vi.fn();
		const message = { id: "m1", sessionId: "s1", role: "assistant" as const, content: "text", toolCalls: null, toolCallId: null, createdAt: 1 };
		render(<MessageBubble message={message} onCopy={onCopy} />);
		await screen.getByTitle("Copiar mensaje").click();
		expect(onCopy).toHaveBeenCalledWith("text");
	});

	it("shows edit button for user messages when onEdit provided", () => {
		const message = { id: "m1", sessionId: "s1", role: "user" as const, content: "editable", toolCalls: null, toolCallId: null, createdAt: 1 };
		render(<MessageBubble message={message} onEdit={vi.fn()} />);
		expect(screen.getByTitle("Editar mensaje")).toBeDefined();
	});

	it("shows delete button when onDelete provided", () => {
		const message = { id: "m1", sessionId: "s1", role: "user" as const, content: "delete me", toolCalls: null, toolCallId: null, createdAt: 1 };
		render(<MessageBubble message={message} onDelete={vi.fn()} />);
		expect(screen.getByTitle("Eliminar mensaje")).toBeDefined();
	});

	it("shows pending tool status", () => {
		const message = {
			id: "m1",
			sessionId: "s1",
			role: "assistant" as const,
			content: null,
			toolCalls: null,
			toolCallId: null,
			createdAt: 1,
		};
		const toolCalls = [
			{ id: "tc1", name: "bash", args: { command: "echo" }, status: "pending" as const },
		];
		render(<MessageBubble message={message} toolCalls={toolCalls} />);
		expect(screen.getByText("bash")).toBeDefined();
	});

	it("renders empty content gracefully", () => {
		const message = { id: "m1", sessionId: "s1", role: "assistant" as const, content: "", toolCalls: null, toolCallId: null, createdAt: 1 };
		render(<MessageBubble message={message} />);
	});
});
