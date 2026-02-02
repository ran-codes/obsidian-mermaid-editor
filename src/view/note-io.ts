import { App, MarkdownView, Notice, TFile } from "obsidian";
import type { BufferOrigin } from "../settings";

const MERMAID_BLOCK_REGEX = /```mermaid\s*\n([\s\S]*?)```/;
const MERMAID_BLOCK_REGEX_G = /```mermaid\s*\n([\s\S]*?)```/g;

export interface NoteLoadResult {
	code: string;
	origin: BufferOrigin;
	totalBlocks: number;
}

export function loadMermaidFromNote(
	app: App,
	options?: { silent?: boolean },
): NoteLoadResult | null {
	const silent = options?.silent ?? false;

	const mdView = app.workspace.getActiveViewOfType(MarkdownView);
	if (!mdView) {
		if (!silent) new Notice("No active Markdown note found.");
		return null;
	}

	const file = mdView.file;
	if (!file) {
		if (!silent) new Notice("No file associated with the active note.");
		return null;
	}

	const editor = mdView.editor;
	const content = editor.getValue();
	const matches = [...content.matchAll(MERMAID_BLOCK_REGEX_G)];
	if (matches.length === 0) {
		if (!silent) new Notice("No Mermaid code block found in the active note.");
		return null;
	}

	// Pick the block at cursor, fall back to first
	const cursorOffset = editor.posToOffset(editor.getCursor());
	let blockIndex = 0;
	for (let i = 0; i < matches.length; i++) {
		const m = matches[i];
		if (m.index !== undefined
			&& cursorOffset >= m.index
			&& cursorOffset <= m.index + m[0].length) {
			blockIndex = i;
			break;
		}
	}

	const match = matches[blockIndex];
	if (!silent) {
		const blockInfo = matches.length > 1
			? ` (block ${blockIndex + 1} of ${matches.length})`
			: "";
		new Notice(`Loaded Mermaid diagram from ${file.name}${blockInfo}.`);
	}

	return {
		code: match[1].trimEnd(),
		origin: { filePath: file.path, blockIndex },
		totalBlocks: matches.length,
	};
}

export async function saveMermaidToNote(
	app: App,
	code: string,
	origin: BufferOrigin | null,
): Promise<{ origin: BufferOrigin; message: string } | null> {
	if (origin) {
		// Save to the originating file and block
		const file = app.vault.getAbstractFileByPath(origin.filePath);
		if (!(file instanceof TFile)) {
			new Notice(`Source file not found: ${origin.filePath}`);
			return null;
		}

		const content = await app.vault.read(file);
		const matches = [...content.matchAll(MERMAID_BLOCK_REGEX_G)];
		const idx = origin.blockIndex;

		if (idx >= matches.length) {
			new Notice(`Mermaid block #${idx + 1} no longer exists in ${file.name}.`);
			return null;
		}

		const match = matches[idx];
		if (match.index === undefined) return null;

		const before = content.slice(0, match.index);
		const after = content.slice(match.index + match[0].length);
		const newContent = before + "```mermaid\n" + code + "\n```" + after;

		await app.vault.modify(file, newContent);
		new Notice(`Updated Mermaid block in ${file.name}.`);
		return { origin, message: `Updated Mermaid block in ${file.name}.` };
	}

	// Fallback: use active editor (no origin tracked yet)
	const mdView = app.workspace.getActiveViewOfType(MarkdownView);
	if (!mdView) {
		new Notice("No source note linked. Load from a note first, or open a note with a Mermaid block.");
		return null;
	}

	const file = mdView.file;
	const editor = mdView.editor;
	const content = editor.getValue();
	const match = MERMAID_BLOCK_REGEX.exec(content);

	if (match && match.index !== undefined) {
		const from = editor.offsetToPos(match.index);
		const to = editor.offsetToPos(match.index + match[0].length);
		editor.replaceRange("```mermaid\n" + code + "\n```", from, to);

		if (file) {
			const newOrigin: BufferOrigin = { filePath: file.path, blockIndex: 0 };
			new Notice("Updated Mermaid block in note.");
			return { origin: newOrigin, message: "Updated Mermaid block in note." };
		}
		new Notice("Updated Mermaid block in note.");
		return null;
	}

	// Append new block at the end
	const allMatches = [...content.matchAll(MERMAID_BLOCK_REGEX_G)];
	const lastLine = editor.lastLine();
	const lastCh = editor.getLine(lastLine).length;
	const pos = { line: lastLine, ch: lastCh };
	editor.replaceRange("\n\n```mermaid\n" + code + "\n```\n", pos);

	if (file) {
		const newOrigin: BufferOrigin = { filePath: file.path, blockIndex: allMatches.length };
		new Notice("Appended new Mermaid block to note.");
		return { origin: newOrigin, message: "Appended new Mermaid block to note." };
	}
	new Notice("Appended new Mermaid block to note.");
	return null;
}
