import { useEffect } from "react";
import { Button } from "./Button";
import { IconAlert, IconInfo, IconX } from "./Icons";

export interface ConfirmDialogProps {
	open: boolean;
	title: string;
	description: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: "danger" | "default";
	busy?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

export function ConfirmDialog({
	open,
	title,
	description,
	confirmLabel = "Confirmar",
	cancelLabel = "Cancelar",
	variant = "danger",
	busy = false,
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !busy) onCancel();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, busy, onCancel]);

	if (!open) return null;

	return (
		<div className="modal-backdrop">
			<div
				className="modal-dialog"
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="confirm-dialog-title"
				aria-describedby="confirm-dialog-desc"
			>
				<div className="modal-header">
					<div className={`modal-badge modal-badge-${variant}`}>
						{variant === "danger" ? <IconAlert size={18} /> : <IconInfo size={18} />}
					</div>
					<h3 id="confirm-dialog-title" className="modal-title">
						{title}
					</h3>
					<button
						type="button"
						className="icon-btn icon-btn-sm"
						onClick={onCancel}
						disabled={busy}
						aria-label="Cerrar diálogo"
					>
						<IconX size={16} />
					</button>
				</div>
				<p id="confirm-dialog-desc" className="modal-body">
					{description}
				</p>
				<div className="modal-footer">
					<Button variant="ghost" onClick={onCancel} disabled={busy}>
						{cancelLabel}
					</Button>
					<Button
						variant={variant === "danger" ? "danger" : "default"}
						busy={busy}
						onClick={onConfirm}
					>
						{confirmLabel}
					</Button>
				</div>
			</div>
		</div>
	);
}
