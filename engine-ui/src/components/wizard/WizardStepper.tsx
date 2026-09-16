export interface Step {
	label: string;
	icon: string;
}

export function WizardStepper({
	steps,
	current,
	completed,
}: { steps: Step[]; current: number; completed: Set<number> }) {
	return (
		<nav className="wizard-stepper" aria-label="Pasos del wizard">
			{steps.map((step, i) => (
				<StepItem key={step.label} step={step} index={i} current={current} completed={completed} />
			))}
		</nav>
	);
}

function StepItem({
	step,
	index,
	current,
	completed,
}: { step: Step; index: number; current: number; completed: Set<number> }) {
	const isCompleted = completed.has(index);
	const isCurrent = index === current;
	const isPast = index < current;

	let className = "step-circle";
	if (isCompleted) className += " done";
	if (isCurrent) className += " active";

	return (
		<>
			{index > 0 ? <div className={`step-connector ${isPast || isCompleted ? "done" : ""}`} /> : null}
			<div className={className} aria-current={isCurrent ? "step" : undefined}>
				{isCompleted ? "✓" : index + 1}
			</div>
			<span className={`step-label ${isCurrent ? "active" : ""} ${isPast || isCompleted ? "done" : ""}`}>
				{step.label}
			</span>
		</>
	);
}
