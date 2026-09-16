import type { ToolRegistry } from "../../tools/registry.js";

export class ToolService {
	constructor(private registry: ToolRegistry) {}

	list() {
		return this.registry.list();
	}

	unregister(name: string): boolean {
		return this.registry.unregister(name);
	}
}
