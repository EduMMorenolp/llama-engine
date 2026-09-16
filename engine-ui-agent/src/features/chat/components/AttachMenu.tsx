import { useEffect, useRef } from "react";
import {
	ChevronRightIcon,
	FileCodeIcon,
	MessageSquareIcon,
	PlugIcon,
	WrenchIcon,
} from "../../../components/ui/Icons.tsx";

interface AttachMenuProps {
	onAddFiles: () => void;
	onSystemMessage: () => void;
	onToggleTools: () => void;
	onMCPServers: () => void;
	onClose: () => void;
}

export function AttachMenu({
	onAddFiles,
	onSystemMessage,
	onToggleTools,
	onMCPServers,
	onClose,
}: AttachMenuProps) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				onClose();
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [onClose]);

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [onClose]);

	return (
		<div ref={ref} className="popover-menu">
			<div className="popover-header">
				<span>Opciones y Herramientas</span>
			</div>
			<button type="button" className="popover-item" onClick={onAddFiles}>
				<span className="popover-item-icon">
					<FileCodeIcon size={16} />
				</span>
				<span>Adjuntar archivos</span>
			</button>
			<button type="button" className="popover-item" onClick={onSystemMessage}>
				<span className="popover-item-icon">
					<MessageSquareIcon size={16} />
				</span>
				<span>System Prompt</span>
			</button>
			<button type="button" className="popover-item" onClick={onToggleTools}>
				<span className="popover-item-icon">
					<WrenchIcon size={16} />
				</span>
				<span style={{ flex: 1 }}>Herramientas del Agente</span>
				<ChevronRightIcon size={14} style={{ color: "var(--text-muted)" }} />
			</button>
			<button type="button" className="popover-item" onClick={onMCPServers}>
				<span className="popover-item-icon">
					<PlugIcon size={16} />
				</span>
				<span>Servidores MCP</span>
			</button>
		</div>
	);
}
