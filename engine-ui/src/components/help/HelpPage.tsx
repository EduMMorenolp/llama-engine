import { CHANGELOG, MANUAL } from "../../info";
import { PageHeader } from "../ui/PageHeader";

export function HelpPage() {
	return (
		<div className="page-stack">
			<PageHeader title="Ayuda" description="Historial de versiones y manual de uso del motor" />

			<div className="help-grid">
				<section className="doc-section">
					<h2>Changelog</h2>
					{CHANGELOG.map((entry) => (
						<div key={entry.version} className="changelog-entry">
							<div className="changelog-head">
								<span className="changelog-version">v{entry.version}</span>
								<span className="changelog-date">{entry.date}</span>
							</div>
							<p className="changelog-title">{entry.title}</p>
							<ul>
								{entry.items.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</div>
					))}
				</section>

				<section className="doc-section">
					<h2>Manual de uso</h2>
					{MANUAL.map((sec) => (
						<article key={sec.title} className="manual-sec">
							<h3>{sec.title}</h3>
							{sec.blocks.map((blk) => (
								<div key={blk.heading ?? blk.body[0]}>
									{blk.heading ? <p className="manual-head">{blk.heading}</p> : null}
									{blk.body.map((line) => (
										<p key={line}>{line}</p>
									))}
								</div>
							))}
						</article>
					))}
				</section>
			</div>
		</div>
	);
}
