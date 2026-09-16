import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout/Layout.tsx";
import { ChatView } from "./features/chat/components/ChatView.tsx";
import { SessionsProvider } from "./providers/SessionsProvider.tsx";
import { ToastProvider } from "./providers/ToastProvider.tsx";

export default function App() {
	return (
		<ToastProvider>
			<SessionsProvider>
				<BrowserRouter>
					<Routes>
						<Route element={<Layout />}>
							<Route index element={<ChatView />} />
							<Route path="*" element={<ChatView />} />
						</Route>
					</Routes>
				</BrowserRouter>
			</SessionsProvider>
		</ToastProvider>
	);
}
