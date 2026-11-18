import { useState } from "react";
import { IconInfo } from "./Icons";

export interface InfoTooltipProps {
	text: string;
	recommendation?: string;
	impact?: string;
	position?: "top" | "bottom" | "left" | "right";
}

export function InfoTooltip({ text, recommendation, impact, position = "top" }: InfoTooltipProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<span className={`info-tooltip-wrapper pos-${position}`}>
			<button
				type="button"
				className="info-tooltip-trigger"
				aria-label="Más información"
				tabIndex={0}
				onMouseEnter={() => setIsOpen(true)}
				onMouseLeave={() => setIsOpen(false)}
				onFocus={() => setIsOpen(true)}
				onBlur={() => setIsOpen(false)}
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					setIsOpen((prev) => !prev);
				}}
			>
				<IconInfo size={12} />
			</button>

			{isOpen && (
				<span className="info-tooltip-bubble" role="tooltip">
					<span className="info-tooltip-text">{text}</span>
					{impact && (
						<span className="info-tooltip-impact">
							<strong>Impacto:</strong> {impact}
						</span>
					)}
					{recommendation && (
						<span className="info-tooltip-rec">
							<strong>Recomendado:</strong> {recommendation}
						</span>
					)}
				</span>
			)}
		</span>
	);
}
