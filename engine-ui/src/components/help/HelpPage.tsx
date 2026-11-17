import { useMemo, useState } from "react";
import { getApiKey, getApiUrl } from "../../api";
import { useToast } from "../../context/ToastContext";
import { useRuntime } from "../../hooks/useRuntime";
import { CHANGELOG, MANUAL } from "../../info";
import { Button } from "../ui/Button";
import { IconCopy, IconSearch } from "../ui/Icons";
import { PageHeader, PageSection } from "../ui/PageHeader";

type SnippetKey = "curl" | "python" | "typescript" | "websocket" | "opencode" | "hermes";

export function HelpPage() {
	const { status } = useRuntime();
	const toast = useToast();
	const [snippetTab, setSnippetTab] = useState<SnippetKey>("curl");
	const [searchQuery, setSearchQuery] = useState("");

	const activeModel = status?.loadedModel || "qwen3.5-4b";
	const apiUrl = getApiUrl();
	const wsUrl = apiUrl.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
	const apiKeySample = getApiKey() || "llama-engine-dev";

	const snippets: Record<SnippetKey, { label: string; code: string }> = {
		curl: {
			label: "cURL (Streaming Chat)",
			code: `curl -X POST ${apiUrl}/v1/chat/completions \\
  -H "x-api-key: ${apiKeySample}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${activeModel}",
    "stream": true,
    "messages": [
      {"role": "system", "content": "Sos un asistente útil."},
      {"role": "user", "content": "Hola, ¿qué modelo estás corriendo?"}
    ]
  }'`,
		},
		python: {
			label: "Python (OpenAI SDK)",
			code: `from openai import OpenAI

client = OpenAI(
    base_url="${apiUrl}/v1",
    api_key="${apiKeySample}",
)

stream = client.chat.completions.create(
    model="${activeModel}",
    messages=[{"role": "user", "content": "Explicá el teorema CAP en 3 puntos."}],
    stream=True,
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)`,
		},
		typescript: {
			label: "TypeScript / Fetch",
			code: `const res = await fetch("${apiUrl}/v1/chat/completions", {
  method: "POST",
  headers: {
    "x-api-key": "${apiKeySample}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "${activeModel}",
    messages: [{ role: "user", content: "Hola desde TypeScript" }],
  }),
});

const data = await res.json();
console.log(data.choices[0].message.content);`,
		},
		websocket: {
			label: "WebSocket Telemetría (/api/ws)",
			code: `const ws = new WebSocket("${wsUrl}/api/ws?apiKey=${apiKeySample}&pollMs=3000");

ws.onopen = () => {
  console.log("Conectado a telemetría en vivo de llama-engine");
  // Cambiar intervalo en caliente o forzar refresh:
  ws.send(JSON.stringify({ type: "set_interval", pollMs: 2000 }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "telemetry") {
    console.log("GPU VRAM:", msg.status.gpu.vramUsedMiB, "MiB");
  } else if (msg.type === "pulse") {
    console.log("Velocidad en vivo:", msg.pulse.predictedPerSec, "tok/s");
  }
};`,
		},
		opencode: {
			label: "opencode.json",
			code: `{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "llama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Llama Engine (local)",
      "options": {
        "baseURL": "${apiUrl}/v1",
        "apiKey": "${apiKeySample}"
      },
      "models": {
        "${activeModel}": {
          "name": "${activeModel}"
        }
      }
    }
  }
}`,
		},
		hermes: {
			label: "Hermes Agent (config.yaml)",
			code: `providers:
  llama-engine:
    type: openai
    base_url: "${apiUrl}/v1"
    api_key: "${apiKeySample}"

model_aliases:
  local: "llama-engine/${activeModel}"`,
		},
	};

	const filteredManual = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return MANUAL;
		return MANUAL.filter(
			(sec) =>
				sec.title.toLowerCase().includes(q) ||
				sec.blocks.some(
					(b) =>
						b.heading?.toLowerCase().includes(q) ||
						b.body.some((line) => line.toLowerCase().includes(q)),
				),
		);
	}, [searchQuery]);

	const copySnippet = async () => {
		try {
			await navigator.clipboard.writeText(snippets[snippetTab].code);
			toast.success("Código copiado", `${snippets[snippetTab].label} copiado al portapapeles.`);
		} catch {
			toast.error("No se pudo copiar");
		}
	};

	return (
		<div className="page-stack">
			<PageHeader
				title="Ayuda & Integración API"
				description="Snippets listos para usar, atajos de teclado, manual de operación y changelog"
			/>

			<PageSection
				title="Integración Rápida OpenAI-Compatible (/v1) & Telemetría WebSocket (/api/ws)"
				subtitle={`Ejemplos preconfigurados con tu endpoint (${apiUrl}) y modelo activo (${activeModel})`}
				actions={
					<Button variant="ghost" size="sm" onClick={copySnippet}>
						<IconCopy size={14} />
						<span>Copiar snippet</span>
					</Button>
				}
			>
				<div className="step-tabs">
					{(Object.keys(snippets) as SnippetKey[]).map((k) => (
						<button
							key={k}
							type="button"
							className={`step-tab ${snippetTab === k ? "active" : ""}`}
							onClick={() => setSnippetTab(k)}
						>
							{snippets[k].label}
						</button>
					))}
				</div>
				<pre className="format-example">{snippets[snippetTab].code}</pre>
			</PageSection>

			<PageSection title="Atajos de Teclado" subtitle="Navegación rápida para usuarios avanzados">
				<div className="shortcuts-grid">
					<div className="shortcut-item">
						<span className="muted">Abrir paleta de comandos y modelos</span>
						<span>
							<kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">K</kbd>
						</span>
					</div>
					<div className="shortcut-item">
						<span className="muted">Enviar mensaje en Playground Studio</span>
						<span>
							<kbd className="kbd">Enter</kbd>
						</span>
					</div>
					<div className="shortcut-item">
						<span className="muted">Salto de línea en Playground Studio</span>
						<span>
							<kbd className="kbd">Shift</kbd> + <kbd className="kbd">Enter</kbd>
						</span>
					</div>
					<div className="shortcut-item">
						<span className="muted">Pegar imagen en Playground Studio (Visión)</span>
						<span>
							<kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">V</kbd>
						</span>
					</div>
					<div className="shortcut-item">
						<span className="muted">Cerrar diálogos o paleta</span>
						<span>
							<kbd className="kbd">Esc</kbd>
						</span>
					</div>
				</div>
			</PageSection>

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
					<div className="doc-section-head">
						<h2>Manual de uso</h2>
						<div className="doc-search-wrap">
							<IconSearch size={14} className="muted" />
							<input
								type="search"
								className="input-sm"
								placeholder="Buscar en el manual…"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>
					</div>
					{filteredManual.length === 0 ? (
						<p className="muted">Sin secciones que coincidan con "{searchQuery}".</p>
					) : (
						filteredManual.map((sec) => (
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
						))
					)}
				</section>
			</div>
		</div>
	);
}
