import mermaid from "mermaid";
import { createPanZoom, type PanZoomInstance } from "./pan-zoom";

let renderCounter = 0;

export function initMermaid(theme: string): void {
	mermaid.initialize({
		startOnLoad: false,
		theme: theme as any,
		securityLevel: "loose",
	});
}

export async function renderMermaid(
	code: string,
	container: HTMLElement,
	errorDisplay: HTMLElement,
): Promise<PanZoomInstance | null> {
	if (!code.trim()) {
		container.empty();
		errorDisplay.textContent = "";
		return null;
	}

	// Re-init each render to pick up theme changes
	// (caller passes theme via initMermaid before calling this)

	// Clean up any orphan mermaid nodes from previous failed renders
	const orphans = document.querySelectorAll("[id^='mermaid-svg-']");
	orphans.forEach((el) => {
		if (!container.contains(el)) {
			el.remove();
		}
	});

	const id = `mermaid-svg-${++renderCounter}`;

	try {
		const { svg, bindFunctions } = await mermaid.render(id, code);
		container.empty();
		const svgDoc = new DOMParser().parseFromString(svg, "image/svg+xml");
		const svgEl = document.importNode(svgDoc.documentElement, true) as unknown as SVGSVGElement;
		container.appendChild(svgEl);
		errorDisplay.textContent = "";

		if (bindFunctions) {
			bindFunctions(container);
		}

		if (svgEl) {
			svgEl.setAttribute("width", "100%");
			svgEl.setAttribute("height", "100%");
			return createPanZoom(svgEl);
		}
		return null;
	} catch (err: any) {
		// mermaid.render creates orphan nodes on failure — clean them up
		const orphan = document.getElementById(id);
		if (orphan && !container.contains(orphan)) {
			orphan.remove();
		}

		errorDisplay.textContent =
			err?.message || err?.str || String(err);
		return null;
	}
}
