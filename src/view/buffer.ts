import type { DataAdapter } from "obsidian";

export async function writeBuffer(adapter: DataAdapter, path: string, content: string): Promise<void> {
	try {
		await adapter.write(path, content);
	} catch (err) {
		console.warn("Mermaid buffer write failed:", err);
	}
}

export async function readBuffer(adapter: DataAdapter, path: string): Promise<string | null> {
	try {
		const exists = await adapter.exists(path);
		if (!exists) return null;
		return await adapter.read(path);
	} catch (err) {
		console.warn("Mermaid buffer read failed:", err);
		return null;
	}
}
