import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";
import { IconAlert, IconRefresh } from "./Icons";

interface Props {
	children: ReactNode;
}

interface State {
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	override state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	override componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("[engine-ui] ErrorBoundary:", error, info);
	}

	handleReset = () => {
		this.setState({ error: null });
	};

	override render() {
		if (this.state.error) {
			return (
				<div className="state-box state-error" role="alert">
					<div className="state-box-head">
						<IconAlert size={20} />
						<p className="state-title">Ocurrió un error al renderizar esta vista</p>
					</div>
					<p className="muted">{this.state.error.message}</p>
					<div className="action-row" style={{ marginTop: 12 }}>
						<Button onClick={this.handleReset}>
							<IconRefresh size={15} />
							<span>Reintentar vista</span>
						</Button>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}

