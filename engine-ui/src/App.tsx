import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Dashboard } from "./components/dashboard/Dashboard";
import { DatasetsPage } from "./components/datasets/DatasetsPage";
import { HelpPage } from "./components/help/HelpPage";
import { Layout } from "./components/layout/Layout";
import { ModelsPage } from "./components/models/ModelsPage";
import { PlaygroundPage } from "./components/playground/PlaygroundPage";
import { RuntimePage } from "./components/runtime/RuntimePage";
import { TelemetryPage } from "./components/telemetry/TelemetryPage";
import { ModelWizard } from "./components/wizard/ModelWizard";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";

export default function App() {
	return (
		<ThemeProvider>
			<ToastProvider>
				<BrowserRouter>
					<Routes>
						<Route element={<Layout />}>
							<Route index element={<Dashboard />} />
							<Route path="/playground" element={<PlaygroundPage />} />
							<Route path="/modelos" element={<ModelsPage />} />
							<Route path="/modelos/crear" element={<ModelWizard />} />
							<Route path="/datasets" element={<DatasetsPage />} />
							<Route path="/runtime" element={<RuntimePage />} />
							<Route path="/telemetria" element={<TelemetryPage />} />
							<Route path="/ayuda" element={<HelpPage />} />
							<Route path="*" element={<Dashboard />} />
						</Route>
					</Routes>
				</BrowserRouter>
			</ToastProvider>
		</ThemeProvider>
	);
}
