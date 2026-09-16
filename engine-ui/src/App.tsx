import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Dashboard } from "./components/dashboard/Dashboard";
import { HelpPage } from "./components/help/HelpPage";
import { Layout } from "./components/layout/Layout";
import { ModelsPage } from "./components/models/ModelsPage";
import { ModelWizard } from "./components/wizard/ModelWizard";
import { RuntimePage } from "./components/runtime/RuntimePage";
import { TelemetryPage } from "./components/telemetry/TelemetryPage";

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route element={<Layout />}>
					<Route index element={<Dashboard />} />
					<Route path="/modelos" element={<ModelsPage />} />
					<Route path="/modelos/crear" element={<ModelWizard />} />
					<Route path="/runtime" element={<RuntimePage />} />
					<Route path="/telemetria" element={<TelemetryPage />} />
					<Route path="/ayuda" element={<HelpPage />} />
					<Route path="*" element={<Dashboard />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}
