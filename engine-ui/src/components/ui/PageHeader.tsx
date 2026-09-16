import type { ReactNode } from "react";

export function PageHeader({ title, description }: { title: string; description?: string }) {
	return (
		<header className="page-header">
			<h1>{title}</h1>
			{description ? <p className="muted">{description}</p> : null}
		</header>
	);
}

export function PageSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="page-section">
			<h2>{title}</h2>
			{children}
		</section>
	);
}
