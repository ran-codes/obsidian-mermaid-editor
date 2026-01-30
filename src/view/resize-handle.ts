import type { PanZoomInstance } from "./pan-zoom";

export function setupResizeHandle(
	handle: HTMLElement,
	codePane: HTMLElement,
	splitPane: HTMLElement,
	onResizeEnd: () => void,
	registerCleanup: (cb: () => void) => void,
): void {
	let startX: number;
	let startLeftWidth: number;

	const onMouseMove = (e: MouseEvent) => {
		const totalWidth = splitPane.clientWidth;
		const handleWidth = handle.clientWidth;
		let newLeftWidth = startLeftWidth + (e.clientX - startX);

		// Clamp between 15% and 85%
		const minWidth = totalWidth * 0.15;
		const maxWidth = totalWidth * 0.85 - handleWidth;
		newLeftWidth = Math.max(minWidth, Math.min(maxWidth, newLeftWidth));

		const pct = (newLeftWidth / totalWidth) * 100;
		codePane.style.flex = `0 0 ${pct}%`;
	};

	const onMouseUp = () => {
		document.removeEventListener("mousemove", onMouseMove);
		document.removeEventListener("mouseup", onMouseUp);
		document.body.classList.remove("mermaid-resizing");
		onResizeEnd();
	};

	handle.addEventListener("mousedown", (e: MouseEvent) => {
		e.preventDefault();
		startX = e.clientX;
		startLeftWidth = codePane.clientWidth;
		document.body.classList.add("mermaid-resizing");
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
	});

	registerCleanup(() => {
		document.removeEventListener("mousemove", onMouseMove);
		document.removeEventListener("mouseup", onMouseUp);
		document.body.classList.remove("mermaid-resizing");
	});
}
