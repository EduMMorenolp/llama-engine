import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "danger" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	busy?: boolean;
	children: ReactNode;
}

export function Button({ variant = "default", busy = false, children, ...rest }: ButtonProps) {
	return (
		<button
			type="button"
			className={`btn btn-${variant}`}
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
