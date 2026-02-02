import svgPanZoom from "svg-pan-zoom";

export type PanZoomInstance = ReturnType<typeof svgPanZoom>;

export function createPanZoom(svgEl: SVGElement): PanZoomInstance {
	return svgPanZoom(svgEl, {
		panEnabled: true,
		zoomEnabled: true,
		mouseWheelZoomEnabled: true,
		dblClickZoomEnabled: true,
		controlIconsEnabled: true,
		fit: true,
		center: true,
		minZoom: 0.1,
		maxZoom: 20,
	});
}

export function destroyPanZoom(instance: PanZoomInstance | null): null {
	if (instance) {
		try {
			instance.destroy();
		} catch {
			// ignore if already destroyed
		}
	}
	return null;
}

export function resetPanZoom(instance: PanZoomInstance | null): void {
	if (instance) {
		instance.resetZoom();
		instance.resetPan();
		instance.center();
		instance.fit();
	}
}
