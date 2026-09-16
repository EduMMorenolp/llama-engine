import { useRef } from "react";
import { FileCodeIcon, XIcon } from "../../../components/ui/Icons.tsx";

export interface FileAttachment {
	id: string;
	name: string;
	type: string;
	size: number;
	preview?: string;
}

interface FileUploadProps {
	attachments: FileAttachment[];
	onAdd: (files: FileList) => void;
	onRemove: (id: string) => void;
}

const ACCEPTED_TYPES = [
	".txt",
	".json",
	".md",
	".csv",
	".xml",
	".yaml",
	".yml",
	".log",
	".js",
	".ts",
	".tsx",
	".py",
	".java",
	".html",
	".css",
	".pdf",
	".png",
	".jpg",
	".jpeg",
	".gif",
	".svg",
	".webp",
];

const MAX_SIZE = 10 * 1024 * 1024;

export function FileUpload({ attachments, onAdd, onRemove }: FileUploadProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const files = e.target.files;
		if (files) onAdd(files);
		if (inputRef.current) inputRef.current.value = "";
	}

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				multiple
				accept={ACCEPTED_TYPES.join(",")}
				onChange={handleChange}
				style={{ display: "none" }}
			/>
			{attachments.length > 0 && (
				<div className="attachments-bar">
					{attachments.map((f) => (
						<div key={f.id} className="file-chip-card">
							{f.preview ? (
								<img src={f.preview} alt={f.name} className="file-chip-thumb" />
							) : (
								<FileCodeIcon size={14} style={{ color: "var(--accent)" }} />
							)}
							<span className="file-chip-name">{f.name}</span>
							<span className="file-chip-size">{formatSize(f.size)}</span>
							<button
								type="button"
								className="file-chip-remove"
								onClick={() => onRemove(f.id)}
								title="Eliminar archivo"
							>
								<XIcon size={12} />
							</button>
						</div>
					))}
				</div>
			)}
		</>
	);
}

export function useFileUpload() {
	function readFile(file: File): Promise<FileAttachment> {
		return new Promise((resolve) => {
			const isImage = file.type.startsWith("image/");
			if (isImage) {
				const reader = new FileReader();
				reader.onload = () => {
					resolve({
						id: crypto.randomUUID?.() ?? Date.now().toString(),
						name: file.name,
						type: file.type,
						size: file.size,
						preview: reader.result as string,
					});
				};
				reader.readAsDataURL(file);
			} else {
				resolve({
					id: crypto.randomUUID?.() ?? Date.now().toString(),
					name: file.name,
					type: file.type,
					size: file.size,
				});
			}
		});
	}

	async function processFiles(fileList: FileList): Promise<FileAttachment[]> {
		const files = Array.from(fileList).filter((f) => f.size <= MAX_SIZE);
		return Promise.all(files.map(readFile));
	}

	return { processFiles };
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
