import type { ReactNode } from "react";

export function PageHeader({
	title,
	description,
	badge,
	actions,
}: {
	title: string;
	description?: string;
	badge?: string;
	actions?: ReactNode;
}) {
	return (
		<header className="page-header">
			<div className="page-header-main">
				<div className="page-title-row">
					<h1>{title}</h1>
					{badge ? <span className="badge badge-on">{badge}</span> : null}
				</div>
				{description ? <p className="muted">{description}</p> : null}
			</div>
			{actions ? <div className="page-header-actions">{actions}</div> : null}
		</header>
	);
}

export function PageSection({
	title,
	subtitle,
	actions,
	className = "",
	children,
}: {
	title: string;
	subtitle?: string;
	actions?: ReactNode;
	className?: string;
	children: ReactNode;
}) {
	return (
		<section className={`page-section card ${className}`.trim()}>
			<div className="section-head">
				<div className="section-head-titles">
					<h2>{title}</h2>
					{subtitle ? <p className="section-subtitle muted">{subtitle}</p> : null}
				</div>
				{actions ? <div className="section-head-actions">{actions}</div> : null}
			</div>
			{children}
		</section>
	);
}
