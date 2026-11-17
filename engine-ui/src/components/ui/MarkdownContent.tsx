import { useState } from "react";
import { useToast } from "../../context/ToastContext";
import { IconCheck, IconCopy } from "./Icons";

interface Segment {
	id: string;
	type: "text" | "code";
	lang?: string;
	content: string;
}

function splitCodeFences(raw: string): Segment[] {
	const segments: Segment[] = [];
	const regex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
	let lastIndex = 0;

	for (const match of raw.matchAll(regex)) {
		const index = match.index ?? 0;
		if (index > lastIndex) {
			const chunk = raw.slice(lastIndex, index);
			segments.push({ id: `seg-${lastIndex}-${chunk.slice(0, 12)}`, type: "text", content: chunk });
		}
		const codeContent = match[2].replace(/\n$/, "");
		segments.push({
			id: `code-${index}-${codeContent.slice(0, 12)}`,
			type: "code",
			lang: match[1] || "code",
			content: codeContent,
		});
		lastIndex = index + match[0].length;
	}

	if (lastIndex < raw.length) {
		const chunk = raw.slice(lastIndex);
		segments.push({ id: `seg-${lastIndex}-${chunk.slice(0, 12)}`, type: "text", content: chunk });
	}
	return segments;
}

/**
 * Extrae bloques `<think>...</think>` embebidos en el contenido si el modelo
 * los emite como texto inline en lugar de `reasoning_content`.
 */
export function extractThinkContent(text: string): {
	thinking: string | null;
	cleanText: string;
	isThinkingOpen: boolean;
} {
	const openIdx = text.indexOf("<think>");
	if (openIdx === -1) {
		return { thinking: null, cleanText: text, isThinkingOpen: false };
	}
	const closeIdx = text.indexOf("</think>", openIdx + 7);
	if (closeIdx === -1) {
		const thinking = text.slice(openIdx + 7).trim();
		const before = text.slice(0, openIdx).trim();
		return { thinking, cleanText: before, isThinkingOpen: true };
	}
	const thinking = text.slice(openIdx + 7, closeIdx).trim();
	const cleanText = `${text.slice(0, openIdx)}${text.slice(closeIdx + 8)}`.trim();
	return { thinking, cleanText, isThinkingOpen: false };
}

function renderInlineFormatting(line: string): React.ReactNode[] {
	const parts = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
	let offset = 0;
	return parts.map((part) => {
		const key = `inl-${offset}-${part.slice(0, 12)}`;
		offset += part.length;
		if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
			return (
				<code key={key} className="md-inline-code">
					{part.slice(1, -1)}
				</code>
			);
		}
		if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
			return <strong key={key}>{part.slice(2, -2)}</strong>;
		}
		return part;
	});
}

function TextBlock({ text }: { text: string }) {
	const lines = text.split("\n");
	const elements: React.ReactNode[] = [];
	let listItems: { id: string; text: string }[] = [];
	let charPos = 0;

	const flushList = (keyPrefix: string) => {
		if (listItems.length === 0) return;
		elements.push(
			<ul key={`list-${keyPrefix}`} className="md-list">
				{listItems.map((item) => (
					<li key={item.id}>{renderInlineFormatting(item.text)}</li>
				))}
			</ul>,
		);
		listItems = [];
	};

	for (const rawLine of lines) {
		const line = rawLine.trimEnd();
		const key = `ln-${charPos}-${line.slice(0, 14)}`;
		charPos += rawLine.length + 1;

		if (/^[-*]\s+/.test(line)) {
			const cleanItem = line.replace(/^[-*]\s+/, "");
			listItems.push({ id: `li-${charPos}-${cleanItem.slice(0, 14)}`, text: cleanItem });
			continue;
		}
		flushList(key);
		if (!line.trim()) {
			continue;
		}
		if (line.startsWith("### ")) {
			elements.push(
				<h4 key={key} className="md-h4">
					{renderInlineFormatting(line.slice(4))}
				</h4>,
			);
		} else if (line.startsWith("## ")) {
			elements.push(
				<h3 key={key} className="md-h3">
					{renderInlineFormatting(line.slice(3))}
				</h3>,
			);
		} else if (line.startsWith("# ")) {
			elements.push(
				<h2 key={key} className="md-h2">
					{renderInlineFormatting(line.slice(2))}
				</h2>,
			);
		} else {
			elements.push(
				<p key={key} className="md-p">
					{renderInlineFormatting(line)}
				</p>,
			);
		}
	}
	flushList("end");

	return <>{elements}</>;
}

function CodeFence({ lang, code }: { lang: string; code: string }) {
	const [copied, setCopied] = useState(false);
	const toast = useToast();

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			toast.success("Código copiado");
			window.setTimeout(() => setCopied(false), 1800);
		} catch {
			toast.error("No se pudo copiar");
		}
	};

	return (
		<div className="md-code-block">
			<div className="md-code-head">
				<span className="md-code-lang mono">{lang || "code"}</span>
				<button type="button" className="md-code-copy" onClick={handleCopy}>
					{copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
					<span>{copied ? "Copiado" : "Copiar"}</span>
				</button>
			</div>
			<pre className="md-code-pre">
				<code>{code}</code>
			</pre>
		</div>
	);
}

export function MarkdownContent({
	content,
	reasoningContent,
}: {
	content: string;
	reasoningContent?: string;
}) {
	const extracted = extractThinkContent(content);
	const fullThinking = [reasoningContent?.trim(), extracted.thinking].filter(Boolean).join("\n\n");
	const segments = splitCodeFences(extracted.cleanText);

	return (
		<div className="md-root">
			{fullThinking ? (
				<details className="md-think-box" open={extracted.isThinkingOpen}>
					<summary className="md-think-summary">
						<span className="md-think-dot" aria-hidden="true" />
						<span>
							{extracted.isThinkingOpen
								? "Razonando paso a paso…"
								: "Proceso de razonamiento (<think>)"}
						</span>
					</summary>
					<div className="md-think-body">{fullThinking}</div>
				</details>
			) : null}

			{segments.map((seg) =>
				seg.type === "code" ? (
					<CodeFence key={seg.id} lang={seg.lang ?? "code"} code={seg.content} />
				) : (
					<TextBlock key={seg.id} text={seg.content} />
				),
			)}
		</div>
	);
}
