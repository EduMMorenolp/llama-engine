import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "primary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
	busy?: boolean;
	children: ReactNode;
}

export function Button({
	variant = "default",
	size = "md",
	busy = false,
	className = "",
	children,
	...rest
}: ButtonProps) {
	return (
		<button
			type="button"
			className={`btn btn-${variant} btn-${size} ${className}`.trim()}
			disabled={busy || rest.disabled}
			aria-busy={busy || undefined}
			{...rest}
		>
			{busy ? (
				<>
					<span className="spinner" aria-hidden="true" />
					<span>{children}</span>
				</>
			) : (
				children
			)}
		</button>
	);
}
