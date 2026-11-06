export interface Step {
	label: string;
	icon: string;
}

export function WizardStepper({
	steps,
	current,
	completed,
	onStepClick,
}: {
	steps: Step[];
	current: number;
	completed: Set<number>;
	onStepClick?: (index: number) => void;
}) {
	return (
		<nav className="wizard-stepper" aria-label="Pasos del wizard">
			{steps.map((step, i) => (
				<StepItem
					key={step.label}
					step={step}
					index={i}
					current={current}
					completed={completed}
					onStepClick={onStepClick}
				/>
			))}
		</nav>
	);
}

function StepItem({
	step,
	index,
	current,
	completed,
	onStepClick,
}: {
	step: Step;
	index: number;
	current: number;
	completed: Set<number>;
	onStepClick?: (index: number) => void;
}) {
	const isCompleted = completed.has(index);
	const isCurrent = index === current;
	const isPast = index < current;

	let className = "step-circle";
	if (isCompleted) className += " done";
	if (isCurrent) className += " active";

	return (
		<>
			{index > 0 ? (
				<div className={`step-connector ${isPast || isCompleted ? "done" : ""}`} />
			) : null}
			{isPast && onStepClick ? (
				<button
					type="button"
					className={`${className} step-circle-btn`}
					onClick={() => onStepClick(index)}
					title={`Volver a ${step.label}`}
				>
					{isCompleted ? "✓" : index + 1}
				</button>
			) : (
				<div className={className} aria-current={isCurrent ? "step" : undefined}>
					{isCompleted ? "✓" : index + 1}
				</div>
			)}
			<span
				className={`step-label ${isCurrent ? "active" : ""} ${isPast || isCompleted ? "done" : ""}`}
			>
				{step.label}
			</span>
		</>
	);
}
