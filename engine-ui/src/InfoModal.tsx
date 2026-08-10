import { useEffect } from "react";
import type { EngineStatus } from "./api";
import { APP_VERSION, CHANGELOG, MANUAL } from "./info";

function fmtUptime(ms: number): string {
	const s = Math.floor(ms / 1000);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	return `${h}h ${m}m ${sec}s`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="info-row">
			<span className="info-label">{label}</span>
			<span className="info-value">{value}</span>
		</div>
	);
}

function InfoModal({ status, onClose }: { status: EngineStatus | null; onClose: () => void }) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const gpu = status?.gpu;

	return (
		<div className="modal-wrap">
			<button
				type="button"
				className="modal-overlay"
				onClick={onClose}
				aria-label="Cerrar"
				title="Cerrar"
			/>
			<div className="modal" role="dialog" aria-modal="true" aria-label="Información del sistema">
				<header className="modal-head">
					<div className="modal-title">🦙 llama-engine · información</div>
					<button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
						×
					</button>
				</header>

				<div className="modal-body">
					<aside className="specs">
						<h3>Sistema</h3>
						<Row label="Versión" value={`v${APP_VERSION}`} />
						<Row label="Uptime API" value={status ? fmtUptime(status.apiUptimeMs) : "—"} />
						<Row label="Modelo cargado" value={status?.loadedModel || "—"} />
						<Row label="Modelos" value={status ? String(status.models.length) : "—"} />
						<Row label="GPU" value={gpu?.available ? gpu.name || "—" : "no disponible"} />
						<Row
							label="VRAM"
							value={gpu?.available ? `${gpu.vramUsedMiB} / ${gpu.vramTotalMiB} MiB` : "—"}
						/>
						<p className="specs-note">
							Motor llama.cpp · backend CUDA (Blackwell) · API OpenAI-compatible
						</p>
					</aside>

					<div className="docs">
						<section className="doc-section">
							<h3>Changelog</h3>
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
							<h3>Manual de uso</h3>
							{MANUAL.map((sec) => (
								<article key={sec.title} className="manual-sec">
									<h4>{sec.title}</h4>
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
			</div>
		</div>
	);
}

export default InfoModal;
