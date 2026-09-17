import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SystemPromptModal } from "./SystemPromptModal.tsx";

describe("SystemPromptModal", () => {
	it("renders with the current prompt", () => {
		render(
			<SystemPromptModal prompt="Current prompt text" onSave={vi.fn()} onClose={vi.fn()} />,
		);
		expect(screen.getByDisplayValue("Current prompt text")).toBeDefined();
	});

	it("renders all three preset buttons", () => {
		render(<SystemPromptModal prompt="" onSave={vi.fn()} onClose={vi.fn()} />);
		expect(screen.getByText("Asistente General")).toBeDefined();
		expect(screen.getByText("Senior Software Engineer")).toBeDefined();
		expect(screen.getByText("Agente Autónomo & Bash")).toBeDefined();
	});

	it("populates textarea when preset is clicked", () => {
		render(<SystemPromptModal prompt="" onSave={vi.fn()} onClose={vi.fn()} />);
		fireEvent.click(screen.getByText("Senior Software Engineer"));
		const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
		expect(textarea.value).toContain("arquitecto e ingeniero de software senior");
	});

	it("calls onSave with current textarea value on save", () => {
		const onSave = vi.fn();
		render(<SystemPromptModal prompt="initial" onSave={onSave} onClose={vi.fn()} />);
		const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: "updated prompt" } });
		fireEvent.click(screen.getByText("Guardar cambios"));
		expect(onSave).toHaveBeenCalledWith("updated prompt");
	});

	it("calls onClose when cancel is clicked", () => {
		const onClose = vi.fn();
		render(<SystemPromptModal prompt="test" onSave={vi.fn()} onClose={onClose} />);
		fireEvent.click(screen.getByText("Cancelar"));
		expect(onClose).toHaveBeenCalled();
	});

	it("calls onClose when X button is clicked", () => {
		const onClose = vi.fn();
		render(<SystemPromptModal prompt="test" onSave={vi.fn()} onClose={onClose} />);
		fireEvent.click(screen.getByLabelText("Cerrar modal"));
		expect(onClose).toHaveBeenCalled();
	});

	it("calls onClose when backdrop is clicked", () => {
		const onClose = vi.fn();
		render(<SystemPromptModal prompt="test" onSave={vi.fn()} onClose={onClose} />);
		fireEvent.click(screen.getByLabelText("Cerrar modal").closest(".dialog-backdrop-btn")!);
		expect(onClose).toHaveBeenCalled();
	});

	it("does not call onSave when cancel is clicked", () => {
		const onSave = vi.fn();
		render(<SystemPromptModal prompt="test" onSave={onSave} onClose={vi.fn()} />);
		fireEvent.click(screen.getByText("Cancelar"));
		expect(onSave).not.toHaveBeenCalled();
	});

	it("each preset contains memory management instructions", () => {
		render(<SystemPromptModal prompt="" onSave={vi.fn()} onClose={vi.fn()} />);

		fireEvent.click(screen.getByText("Asistente General"));
		let textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
		expect(textarea.value).toContain("memorize");
		expect(textarea.value).toContain("search_memories");

		fireEvent.click(screen.getByText("Senior Software Engineer"));
		textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
		expect(textarea.value).toContain("memorize");

		fireEvent.click(screen.getByText("Agente Autónomo & Bash"));
		textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
		expect(textarea.value).toContain("memorize");
		expect(textarea.value).toContain("Seguridad");
	});
});
