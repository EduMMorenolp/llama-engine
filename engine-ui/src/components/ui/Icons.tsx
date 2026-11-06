import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.85}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...rest}
		>
			{children}
		</svg>
	);
}

export function IconDashboard(props: IconProps) {
	return (
		<Svg {...props}>
			<rect x="3" y="3" width="7" height="9" rx="1.5" />
			<rect x="14" y="3" width="7" height="5" rx="1.5" />
			<rect x="14" y="12" width="7" height="9" rx="1.5" />
			<rect x="3" y="16" width="7" height="5" rx="1.5" />
		</Svg>
	);
}

export function IconPlayground(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
			<path d="M8 9h8" />
			<path d="M8 13h5" />
		</Svg>
	);
}

export function IconModels(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
			<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
			<line x1="12" y1="22.08" x2="12" y2="12" />
		</Svg>
	);
}

export function IconSparkles(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
			<path d="M5 3v4" />
			<path d="M3 5h4" />
		</Svg>
	);
}

export function IconDatabase(props: IconProps) {
	return (
		<Svg {...props}>
			<ellipse cx="12" cy="5" rx="9" ry="3" />
			<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
			<path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
		</Svg>
	);
}

export function IconCpu(props: IconProps) {
	return (
		<Svg {...props}>
			<rect x="4" y="4" width="16" height="16" rx="2" />
			<rect x="9" y="9" width="6" height="6" />
			<path d="M15 2v2" />
			<path d="M15 20v2" />
			<path d="M2 15h2" />
			<path d="M2 9h2" />
			<path d="M20 15h2" />
			<path d="M20 9h2" />
			<path d="M9 2v2" />
			<path d="M9 20v2" />
		</Svg>
	);
}

export function IconActivity(props: IconProps) {
	return (
		<Svg {...props}>
			<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
		</Svg>
	);
}

export function IconHelp(props: IconProps) {
	return (
		<Svg {...props}>
			<circle cx="12" cy="12" r="10" />
			<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
			<line x1="12" y1="17" x2="12.01" y2="17" />
		</Svg>
	);
}

export function IconSearch(props: IconProps) {
	return (
		<Svg {...props}>
			<circle cx="11" cy="11" r="8" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</Svg>
	);
}

export function IconSun(props: IconProps) {
	return (
		<Svg {...props}>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2" />
			<path d="M12 20v2" />
			<path d="m4.93 4.93 1.41 1.41" />
			<path d="m17.66 17.66 1.41 1.41" />
			<path d="M2 12h2" />
			<path d="M20 12h2" />
			<path d="m6.34 17.66-1.41 1.41" />
			<path d="m19.07 4.93-1.41 1.41" />
		</Svg>
	);
}

export function IconMoon(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
		</Svg>
	);
}

export function IconRefresh(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
			<path d="M3 3v5h5" />
			<path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
			<path d="M16 16h5v5" />
		</Svg>
	);
}

export function IconPlay(props: IconProps) {
	return (
		<Svg {...props}>
			<polygon points="6 3 20 12 6 21 6 3" />
		</Svg>
	);
}

export function IconPause(props: IconProps) {
	return (
		<Svg {...props}>
			<rect x="6" y="4" width="4" height="16" />
			<rect x="14" y="4" width="4" height="16" />
		</Svg>
	);
}

export function IconStop(props: IconProps) {
	return (
		<Svg {...props}>
			<rect x="5" y="5" width="14" height="14" rx="2" />
		</Svg>
	);
}

export function IconTrash(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M3 6h18" />
			<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
			<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
		</Svg>
	);
}

export function IconCheck(props: IconProps) {
	return (
		<Svg {...props}>
			<polyline points="20 6 9 17 4 12" />
		</Svg>
	);
}

export function IconAlert(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
			<line x1="12" y1="9" x2="12" y2="13" />
			<line x1="12" y1="17" x2="12.01" y2="17" />
		</Svg>
	);
}

export function IconInfo(props: IconProps) {
	return (
		<Svg {...props}>
			<circle cx="12" cy="12" r="10" />
			<line x1="12" y1="16" x2="12" y2="12" />
			<line x1="12" y1="8" x2="12.01" y2="8" />
		</Svg>
	);
}

export function IconX(props: IconProps) {
	return (
		<Svg {...props}>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</Svg>
	);
}

export function IconCopy(props: IconProps) {
	return (
		<Svg {...props}>
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
			<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
		</Svg>
	);
}

export function IconDownload(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="7 10 12 15 17 10" />
			<line x1="12" y1="15" x2="12" y2="3" />
		</Svg>
	);
}

export function IconUpload(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="17 8 12 3 7 8" />
			<line x1="12" y1="3" x2="12" y2="15" />
		</Svg>
	);
}

export function IconImage(props: IconProps) {
	return (
		<Svg {...props}>
			<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
			<circle cx="8.5" cy="8.5" r="1.5" />
			<polyline points="21 15 16 10 5 21" />
		</Svg>
	);
}

export function IconSend(props: IconProps) {
	return (
		<Svg {...props}>
			<line x1="22" y1="2" x2="11" y2="13" />
			<polygon points="22 2 15 22 11 13 2 9 22 2" />
		</Svg>
	);
}

export function IconSliders(props: IconProps) {
	return (
		<Svg {...props}>
			<line x1="4" y1="21" x2="4" y2="14" />
			<line x1="4" y1="10" x2="4" y2="3" />
			<line x1="12" y1="21" x2="12" y2="12" />
			<line x1="12" y1="8" x2="12" y2="3" />
			<line x1="20" y1="21" x2="20" y2="16" />
			<line x1="20" y1="12" x2="20" y2="3" />
			<line x1="2" y1="14" x2="6" y2="14" />
			<line x1="10" y1="8" x2="14" y2="8" />
			<line x1="18" y1="16" x2="22" y2="16" />
		</Svg>
	);
}

export function IconTerminal(props: IconProps) {
	return (
		<Svg {...props}>
			<polyline points="4 17 10 11 4 5" />
			<line x1="12" y1="19" x2="20" y2="19" />
		</Svg>
	);
}

export function IconEye(props: IconProps) {
	return (
		<Svg {...props}>
			<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
			<circle cx="12" cy="12" r="3" />
		</Svg>
	);
}

export function IconBolt(props: IconProps) {
	return (
		<Svg {...props}>
			<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
		</Svg>
	);
}

export function IconMenu(props: IconProps) {
	return (
		<Svg {...props}>
			<line x1="4" y1="6" x2="20" y2="6" />
			<line x1="4" y1="12" x2="20" y2="12" />
			<line x1="4" y1="18" x2="20" y2="18" />
		</Svg>
	);
}

