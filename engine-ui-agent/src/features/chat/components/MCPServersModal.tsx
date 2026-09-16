import { useCallback, useEffect, useState } from "react";
import {
	addMCPServer,
	connectMCPServer,
	deleteMCPServer,
	disconnectMCPServer,
	fetchMCPServers,
	type MCPServer,
} from "../../../api.ts";
import { PlugIcon, PlusIcon, TrashIcon, XIcon } from "../../../components/ui/Icons.tsx";
import { useToast } from "../../../providers/ToastProvider.tsx";

interface MCPServersModalProps {
	onClose: () => void;
}

export function MCPServersModal({ onClose }: MCPServersModalProps) {
	const { addToast } = useToast();
	const [servers, setServers] = useState<MCPServer[]>([]);
	const [loading, setLoading] = useState(false);
	const [showAddForm, setShowAddForm] = useState(false);
	const [newName, setNewName] = useState("");
	const [newCommand, setNewCommand] = useState("npx");
	const [newArgs, setNewArgs] = useState("-y @modelcontextprotocol/server-");

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const list = await fetchMCPServers();
			setServers(list || []);
		} catch (err) {
			console.warn("[mcp] Error al cargar servidores:", err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const handleConnect = async (server: MCPServer) => {
		try {
			if (server.status === "connected") {
				await disconnectMCPServer(server.id);
				addToast("info", `Desconectado de ${server.name}`);
			} else {
				const res = await connectMCPServer(server.id);
				if (res.success) {
					addToast(
						"success",
						`Conectado a ${server.name} (${res.tools.length} herramientas agregadas)`,
					);
				} else {
					addToast("error", res.error || "No se pudo conectar al servidor MCP");
				}
			}
			load();
		} catch (err: unknown) {
			addToast("error", err instanceof Error ? err.message : "Error de comunicación MCP");
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteMCPServer(id);
			addToast("info", "Servidor MCP eliminado");
			load();
		} catch (err: unknown) {
			addToast("error", err instanceof Error ? err.message : "Error al eliminar");
		}
	};

	const handleAddServer = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newName.trim() || !newCommand.trim()) return;
		try {
			const argsArray = newArgs.trim().split(/\s+/).filter(Boolean);
			await addMCPServer({
				name: newName.trim(),
				transport: "stdio",
				command: newCommand.trim(),
				args: argsArray,
			});
			addToast("success", `Servidor ${newName} agregado`);
			setNewName("");
			setNewArgs("");
			setShowAddForm(false);
			load();
		} catch (err: unknown) {
			addToast("error", err instanceof Error ? err.message : "Error al registrar servidor MCP");
		}
	};

	return (
		<div className="dialog-backdrop">
			<button
				type="button"
				className="dialog-backdrop-btn"
				onClick={onClose}
				aria-label="Cerrar modal"
			/>
			<div
				className="dialog-card mcp-dialog"
				style={{ zIndex: 1, position: "relative", maxWidth: "600px" }}
			>
				<div className="dialog-title-row">
					<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
						<PlugIcon size={20} style={{ color: "var(--accent)" }} />
						<div>
							<span className="dialog-title">Servidores MCP</span>
							<div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
								Model Context Protocol — Herramientas y recursos externos
							</div>
						</div>
					</div>
					<button
						type="button"
						className="session-action-btn"
						onClick={onClose}
						title="Cerrar modal"
						style={{ opacity: 1 }}
					>
						<XIcon size={18} />
					</button>
				</div>

				<div className="mcp-server-list">
					{loading && servers.length === 0 ? (
						<div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
							Cargando servidores MCP...
						</div>
					) : servers.length === 0 ? (
						<div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
							No hay servidores MCP configurados.
						</div>
					) : (
						servers.map((server) => (
							<div key={server.id} className="mcp-server-item">
								<div className="mcp-server-info">
									<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
										<div
											className={`connection-dot ${
												server.status === "connected"
													? "connected"
													: server.status === "error"
														? "disconnected"
														: ""
											}`}
										/>
										<span className="mcp-server-name">{server.name}</span>
										<span className="mcp-server-transport">{server.transport}</span>
									</div>
									<div className="mcp-server-cmd">
										{server.command} {server.args?.join(" ")}
									</div>
									{server.errorMessage && (
										<div className="mcp-server-error">{server.errorMessage}</div>
									)}
								</div>

								<div className="mcp-server-actions">
									{server.toolsCount !== undefined && server.toolsCount > 0 && (
										<span className="mcp-tools-badge">
											{server.toolsCount} {server.toolsCount === 1 ? "herramienta" : "herramientas"}
										</span>
									)}
									<button
										type="button"
										className={`btn-secondary ${server.status === "connected" ? "active-glow" : ""}`}
										style={{ fontSize: "12px", padding: "5px 12px" }}
										onClick={() => handleConnect(server)}
									>
										{server.status === "connected" ? "Desconectar" : "Conectar"}
									</button>
									<button
										type="button"
										className="session-action-btn"
										title="Eliminar"
										onClick={() => handleDelete(server.id)}
									>
										<TrashIcon size={14} />
									</button>
								</div>
							</div>
						))
					)}
				</div>

				{showAddForm ? (
					<form onSubmit={handleAddServer} className="mcp-add-form">
						<div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
							Registrar nuevo servidor MCP
						</div>
						<div className="mcp-input-group">
							<input
								type="text"
								className="sidebar-search-input"
								placeholder="Nombre del servidor (ej. GitHub MCP)"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								required
							/>
						</div>
						<div style={{ display: "flex", gap: "8px" }}>
							<input
								type="text"
								className="sidebar-search-input"
								style={{ width: "100px" }}
								placeholder="Comando"
								value={newCommand}
								onChange={(e) => setNewCommand(e.target.value)}
								required
							/>
							<input
								type="text"
								className="sidebar-search-input"
								style={{ flex: 1 }}
								placeholder="Argumentos (ej. -y @modelcontextprotocol/server-sqlite --db path.db)"
								value={newArgs}
								onChange={(e) => setNewArgs(e.target.value)}
							/>
						</div>
						<div
							style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }}
						>
							<button
								type="button"
								className="btn-secondary"
								style={{ fontSize: "12px", padding: "4px 10px" }}
								onClick={() => setShowAddForm(false)}
							>
								Cancelar
							</button>
							<button
								type="submit"
								className="btn-primary"
								style={{ fontSize: "12px", padding: "4px 12px" }}
							>
								Registrar
							</button>
						</div>
					</form>
				) : (
					<button
						type="button"
						className="new-chat-btn"
						style={{ justifyContent: "center", gap: "8px", marginTop: "8px" }}
						onClick={() => setShowAddForm(true)}
					>
						<PlusIcon size={15} />
						<span>Agregar servidor personalizado</span>
					</button>
				)}

				<div className="dialog-footer" style={{ marginTop: "12px" }}>
					<button type="button" className="btn-secondary" onClick={onClose}>
						Cerrar
					</button>
				</div>
			</div>
		</div>
	);
}
