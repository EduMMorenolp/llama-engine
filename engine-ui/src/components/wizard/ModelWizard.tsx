import { useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
	type Dataset,
	deployModel,
	type QuantizeResult,
	startTraining,
	stopTraining,
	type TrainingJob,
} from "../../api";
import { useToast } from "../../context/ToastContext";
import { PageHeader } from "../ui/PageHeader";
import { type BaseModelSelection, BaseModelStep } from "./BaseModelStep";
import { DatasetStep } from "./DatasetStep";
import { DeployStep } from "./DeployStep";
import { FlowSelector } from "./FlowSelector";
import { QuantizeStep } from "./QuantizeStep";
import { type TrainingConfig, TrainingConfigStep } from "./TrainingConfigStep";
import { TrainingProgressStep } from "./TrainingProgressStep";
import { WizardNavigation } from "./WizardNavigation";
import { type Step, WizardStepper } from "./WizardStepper";

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
	const toast = useToast();
	const [searchParams] = useSearchParams();
	const [flow, setFlow] = useState<Flow | null>(() => {
		const f = searchParams.get("flow");
		return f === "create" || f === "improve" || f === "optimize" ? f : null;
	});
	const [initialDatasetId] = useState(() => searchParams.get("datasetId") ?? undefined);
	const [step, setStep] = useState(0);
	const [completed, setCompleted] = useState<Set<number>>(new Set());

	const [baseModel, setBaseModel] = useState<BaseModelSelection | null>(null);
	const [dataset, setDataset] = useState<Dataset | null>(null);
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
	const [quantizeResult, setQuantizeResult] = useState<{
		method: string;
		outputSize: number;
	} | null>(null);
	const [busy, setBusy] = useState(false);
	const [wizardError, setWizardError] = useState<string | null>(null);

	const steps = flow ? STEPS[flow] : [];
	const totalSteps = steps.length;

	const canNext = (() => {
		if (!flow) return false;
		switch (step) {
			case 0:
				return baseModel !== null;
			case 1:
				return flow === "optimize" || dataset !== null;
			case 2:
				return flow === "optimize" || (baseModel !== null && dataset !== null);
			default:
				return true;
		}
	})();

	const handleNext = async () => {
		setWizardError(null);

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
				toast.info("Entrenamiento iniciado", `Job ID: ${data.jobId}`);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				setWizardError(`No se pudo iniciar el entrenamiento: ${msg}`);
				toast.error("Error al iniciar entrenamiento", msg);
				setBusy(false);
				return;
			}
			setBusy(false);
		}

		setCompleted((prev) => new Set([...prev, step]));
		if (step < totalSteps - 1) {
			setStep(step + 1);
		}
	};

	const handleBack = () => {
		setWizardError(null);
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
		setWizardError(null);
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
		setWizardError(null);
	};

	const handleTrainingComplete = useCallback(() => {
		setCompleted((prev) => new Set([...prev, step]));
		if (step < totalSteps - 1) setStep(step + 1);
	}, [step, totalSteps]);

	const handleTrainStop = async () => {
		if (!trainJobId) return;
		try {
			await stopTraining(trainJobId);
			toast.warning("Entrenamiento detenido");
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error("No se pudo detener el entrenamiento", msg);
		}
	};

	const handleDeploy = async (activate: boolean) => {
		setBusy(true);
		setWizardError(null);
		try {
			const modelName = `${baseModel?.id}-${quantizeResult?.method ?? config.method}`;
			const res = await deployModel(modelName, activate);
			if (!res.ok) {
				setWizardError(res.message ?? "No se pudo desplegar el modelo");
				return;
			}
			setCompleted((prev) => new Set([...prev, step]));
			toast.success("Modelo desplegado", res.message ?? `${modelName} disponible en /models`);
			navigate("/modelos");
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			setWizardError(`Error al desplegar: ${msg}`);
			toast.error("Error al desplegar modelo", msg);
		} finally {
			setBusy(false);
		}
	};

	const handleQuantizeCompleted = (result: QuantizeResult, fallbackMethod: string) => {
		setQuantizeResult({
			method: result.method ?? fallbackMethod,
			outputSize: result.outputSize ?? 0,
		});
		toast.success(
			"Quantización iniciada / completada",
			`Método: ${result.method ?? fallbackMethod}`,
		);
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
							onComplete={(result) => handleQuantizeCompleted(result, "Q4_K_M")}
						/>
					);
				}
				return <DatasetStep value={dataset} onChange={setDataset} preselectId={initialDatasetId} />;
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
							onComplete={(result) => handleQuantizeCompleted(result, "Q4_K_M")}
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
				description="Guiate paso a paso para crear, mejorar u optimizar modelos GGUF"
				badge={flow ? `Flujo: ${flow.toUpperCase()}` : undefined}
			/>

			{!flow ? (
				<FlowSelector selected={flow} onSelect={handleFlowSelect} />
			) : (
				<div className="wizard card">
					<WizardStepper
						steps={steps}
						current={step}
						completed={completed}
						onStepClick={(idx) => setStep(idx)}
					/>

					{wizardError ? (
						<div className="error" role="alert">
							{wizardError}
						</div>
					) : null}

					<div className="wizard-content">{renderStep()}</div>

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
