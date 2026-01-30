import type { DataAdapter } from "obsidian";

export async function writeBuffer(adapter: DataAdapter, path: string, content: string): Promise<number> {
	try {
		await adapter.write(path, content);
	} catch (err) {
		console.warn("Mermaid buffer write failed:", err);
	}
	return Date.now();
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

export async function getBufferMtime(adapter: DataAdapter, path: string): Promise<number | null> {
	try {
		const stat = await adapter.stat(path);
		return stat?.mtime ?? null;
	} catch {
		return null;
	}
}
