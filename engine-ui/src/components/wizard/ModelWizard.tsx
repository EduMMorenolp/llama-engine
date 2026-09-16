import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../ui/PageHeader";
import { WizardStepper, type Step } from "./WizardStepper";
import { WizardNavigation } from "./WizardNavigation";
import { FlowSelector } from "./FlowSelector";
import { BaseModelStep, type BaseModelSelection } from "./BaseModelStep";
import { DatasetStep, type DatasetInfo } from "./DatasetStep";
import { TrainingConfigStep, type TrainingConfig } from "./TrainingConfigStep";
import { TrainingProgressStep } from "./TrainingProgressStep";
import { QuantizeStep } from "./QuantizeStep";
import { DeployStep } from "./DeployStep";
import { startTraining, stopTraining, deployModel, quantizeModel, type TrainingJob } from "../../api";

type Flow = "create" | "improve" | "optimize";

const STEPS: Record<Flow, Step[]> = {
	create: [
		{ label: "Modelo base", icon: "📦" },
		{ label: "Dataset", icon: "📄" },
		{ label: "Configuración", icon: "⚙" },
		{ label: "Entrenamiento", icon: "🔥" },
		{ label: "Quantización", icon: "⚡" },
		{ label: "Deploy", icon: "🚀" },
	],
	improve: [
		{ label: "Modelo", icon: "📦" },
		{ label: "Dataset", icon: "📄" },
		{ label: "Configuración", icon: "⚙" },
		{ label: "Entrenamiento", icon: "🔥" },
		{ label: "Deploy", icon: "🚀" },
	],
	optimize: [
		{ label: "Modelo", icon: "📦" },
		{ label: "Quantización", icon: "⚡" },
		{ label: "Deploy", icon: "🚀" },
	],
};

export function ModelWizard() {
	const navigate = useNavigate();
	const [flow, setFlow] = useState<Flow | null>(null);
	const [step, setStep] = useState(0);
	const [completed, setCompleted] = useState<Set<number>>(new Set());

	const [baseModel, setBaseModel] = useState<BaseModelSelection | null>(null);
	const [dataset, setDataset] = useState<DatasetInfo | null>(null);
	const [config, setConfig] = useState<TrainingConfig>({
		method: "qlora",
		epochs: 3,
		learningRate: 2e-4,
		rank: 64,
		batchSize: 4,
		maxSeqLen: 2048,
		systemPrompt: "",
	});
	const [trainJobId, setTrainJobId] = useState<string | null>(null);
	const [trainJob, setTrainJob] = useState<TrainingJob | undefined>(undefined);
	const [quantizeResult, setQuantizeResult] = useState<{ method: string; outputSize: number } | null>(null);
	const [busy, setBusy] = useState(false);

	const steps = flow ? STEPS[flow] : [];
	const totalSteps = steps.length;

	const canNext = (() => {
		if (!flow) return false;
		switch (step) {
			case 0: return baseModel !== null;
			case 1: return flow === "optimize" || dataset !== null;
			case 2: return flow === "optimize";
			default: return true;
		}
	})();

	const handleNext = async () => {
		setCompleted((prev) => new Set([...prev, step]));

		if (step === 2 && (flow === "create" || flow === "improve")) {
			setBusy(true);
			try {
				const data = await startTraining({
					baseModelId: baseModel?.id ?? "",
					datasetId: dataset?.id ?? "",
					method: config.method,
					epochs: config.epochs,
					learningRate: config.learningRate,
					rank: config.rank,
					batchSize: config.batchSize,
					maxSeqLen: config.maxSeqLen,
					systemPrompt: config.systemPrompt,
				});
				setTrainJobId(data.jobId);
			} catch {
				// Silently handle error
			} finally {
				setBusy(false);
			}
		}

		if (step < totalSteps - 1) {
			setStep(step + 1);
		}
	};

	const handleBack = () => {
		if (step > 0) setStep(step - 1);
	};

	const handleCancel = () => {
		setFlow(null);
		setStep(0);
		setCompleted(new Set());
		setBaseModel(null);
		setDataset(null);
		setTrainJobId(null);
		setTrainJob(undefined);
		setQuantizeResult(null);
	};

	const handleFlowSelect = (f: Flow) => {
		setFlow(f);
		setStep(0);
		setCompleted(new Set());
		setBaseModel(null);
		setDataset(null);
		setTrainJobId(null);
		setTrainJob(undefined);
		setQuantizeResult(null);
	};

	const handleTrainingComplete = useCallback(() => {
		setCompleted((prev) => new Set([...prev, step]));
		if (step < totalSteps - 1) setStep(step + 1);
	}, [step, totalSteps]);

	const handleTrainStop = async () => {
		if (!trainJobId) return;
		try {
			await stopTraining(trainJobId);
		} catch {
			// Silently handle error
		}
	};

	const handleDeploy = async (activate: boolean) => {
		setBusy(true);
		try {
			const modelName = `${baseModel?.id}-${quantizeResult?.method ?? config.method}`;
			const res = await deployModel(modelName, activate);
			if (!res.ok) return;
			setCompleted((prev) => new Set([...prev, step]));
			navigate("/modelos");
		} catch {
			// Silently handle error
		} finally {
			setBusy(false);
		}
	};

	const handleQuantize = async (modelId: string, method: string) => {
		setBusy(true);
		try {
			const result = await quantizeModel(modelId, method);
			setQuantizeResult({ method: result.method, outputSize: result.outputSize });
		} catch {
			// Silently handle error
		} finally {
			setBusy(false);
		}
	};

	const renderStep = () => {
		if (!flow) return null;

		switch (step) {
			case 0:
				return <BaseModelStep value={baseModel} onChange={setBaseModel} flow={flow} />;
			case 1:
				if (flow === "optimize") {
					return (
						<QuantizeStep
							modelId={baseModel?.id ?? ""}
							modelSize={0}
							onComplete={(result) => handleQuantize(baseModel?.id ?? "", result.method)}
						/>
					);
				}
				return <DatasetStep value={dataset} onChange={setDataset} />;
			case 2:
				if (flow === "optimize") {
					return (
						<DeployStep
							info={{
								name: `${baseModel?.id}-${quantizeResult?.method ?? "Q4_K_M"}`,
								baseModel: baseModel?.id ?? "",
								dataset: "N/A",
								method: "Quantización directa",
								quantMethod: quantizeResult?.method ?? "Q4_K_M",
								sizeBytes: quantizeResult?.outputSize ?? 0,
								path: `/models/${baseModel?.id}-${quantizeResult?.method ?? "Q4_K_M"}.gguf`,
							}}
							onDeploy={handleDeploy}
						/>
					);
				}
				return <TrainingConfigStep value={config} onChange={setConfig} />;
			case 3:
				return (
					<TrainingProgressStep
						jobId={trainJobId}
						job={trainJob}
						onComplete={handleTrainingComplete}
						onStop={handleTrainStop}
					/>
				);
			case 4:
				if (flow === "create") {
					return (
						<QuantizeStep
							modelId={trainJobId ?? baseModel?.id ?? ""}
							modelSize={0}
							onComplete={(result) => handleQuantize(trainJobId ?? baseModel?.id ?? "", result.method)}
						/>
					);
				}
				return (
					<DeployStep
						info={{
							name: `${baseModel?.id}-${config.method}-ft`,
							baseModel: baseModel?.id ?? "",
							dataset: dataset?.name ?? "",
							method: config.method.toUpperCase(),
							quantMethod: "sin quantizar",
							sizeBytes: 0,
							path: `/models/${baseModel?.id}-${config.method}-ft.gguf`,
						}}
						onDeploy={handleDeploy}
					/>
				);
			case 5:
				return (
					<DeployStep
						info={{
							name: `${baseModel?.id}-${quantizeResult?.method ?? "Q4_K_M"}`,
							baseModel: baseModel?.id ?? "",
							dataset: dataset?.name ?? "",
							method: config.method.toUpperCase(),
							quantMethod: quantizeResult?.method ?? "Q4_K_M",
							sizeBytes: quantizeResult?.outputSize ?? 0,
							path: `/models/${baseModel?.id}-${quantizeResult?.method ?? "Q4_K_M"}.gguf`,
						}}
						onDeploy={handleDeploy}
					/>
				);
			default:
				return null;
		}
	};

	return (
		<div className="page-stack">
			<PageHeader
				title="Asistente de Modelos"
				description="Guiáte paso a paso para crear, mejorar u optimizar modelos"
			/>

			{!flow ? (
				<FlowSelector selected={flow} onSelect={handleFlowSelect} />
			) : (
				<div className="wizard">
					<WizardStepper steps={steps} current={step} completed={completed} />

					<div className="wizard-content">
						{renderStep()}
					</div>

					{!(step === totalSteps - 1 && flow === "optimize") && (
						<WizardNavigation
							current={step}
							total={totalSteps}
							busy={busy}
							busyLabel={busy ? "Procesando..." : undefined}
							onBack={handleBack}
							onNext={handleNext}
							onCancel={handleCancel}
							canNext={canNext}
						/>
					)}
				</div>
			)}
		</div>
	);
}
