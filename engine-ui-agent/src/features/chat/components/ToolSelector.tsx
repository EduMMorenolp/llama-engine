import { useEffect, useRef } from "react";
import {
	BrainIcon,
	FileCodeIcon,
	SearchIcon,
	TerminalIcon,
	WrenchIcon,
} from "../../../components/ui/Icons.tsx";

export interface ToolConfig {
	name: string;
	label: string;
	iconType?: string;
	enabled: boolean;
}

interface ToolSelectorProps {
	tools: ToolConfig[];
	onToggle: (name: string) => void;
	onClose: () => void;
}

function getToolIcon(name: string) {
	switch (name) {
		case "bash":
			return <TerminalIcon size={15} />;
		case "read_file":
		case "write_file":
		case "edit_file":
			return <FileCodeIcon size={15} />;
		case "glob_search":
		case "grep_search":
			return <SearchIcon size={15} />;
		case "memorize":
		case "search_memories":
			return <BrainIcon size={15} />;
		default:
			return <WrenchIcon size={15} />;
	}
}

export function ToolSelector({ tools, onToggle, onClose }: ToolSelectorProps) {
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

	const activeCount = tools.filter((t) => t.enabled).length;

	return (
		<div ref={ref} className="popover-menu" style={{ minWidth: "260px" }}>
			<div className="popover-header">
				<span>Herramientas Activas</span>
				<span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
					{activeCount}/{tools.length}
				</span>
			</div>
			{tools.map((tool) => (
				<button
					key={tool.name}
					type="button"
					className="popover-item"
					onClick={() => onToggle(tool.name)}
				>
					<span className="popover-item-icon">{getToolIcon(tool.name)}</span>
					<span style={{ flex: 1, fontSize: "13px" }}>{tool.label}</span>
					<div className={`toggle-switch ${tool.enabled ? "active" : ""}`}>
						<div className="toggle-knob" />
					</div>
				</button>
			))}
		</div>
	);
}
