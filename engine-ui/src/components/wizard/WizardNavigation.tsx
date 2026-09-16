import { Button } from "../ui/Button";

export function WizardNavigation({
	current,
	total,
	busy,
	busyLabel,
	onBack,
	onNext,
	onCancel,
	canNext,
}: {
	current: number;
	total: number;
	busy: boolean;
	busyLabel?: string;
	onBack: () => void;
	onNext: () => void;
	onCancel: () => void;
	canNext?: boolean;
}) {
	const isLast = current === total - 1;
	return (
		<div className="wizard-nav">
			<Button variant="ghost" onClick={onCancel}>
				Cancelar
			</Button>
			<div className="wizard-nav-right">
				{current > 0 ? (
					<Button variant="ghost" onClick={onBack} disabled={busy}>
						← Anterior
					</Button>
				) : null}
				{!isLast ? (
					<Button onClick={onNext} disabled={busy || canNext === false} busy={busy}>
						{busy && busyLabel ? busyLabel : "Siguiente →"}
					</Button>
				) : (
					<Button onClick={onNext} disabled={busy || canNext === false} busy={busy}>
						{busy && busyLabel ? busyLabel : "Finalizar"}
					</Button>
				)}
			</div>
		</div>
	);
}
