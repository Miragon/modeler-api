import type Canvas from 'diagram-js/lib/core/Canvas';
import type ContentBounds from './ContentBounds.js';

const EXPORT_PADDING = 20;
const EMPTY_EXPORT = { x: 0, y: 0, width: 800, height: 600 };
/** What the live canvas carries for keyboard and screen-reader use, not for a picture. */
const LIVE_CANVAS_ATTRIBUTES = ['tabindex', 'role', 'aria-label', 'aria-roledescription'];

/**
 * A standalone SVG of the content. The canvas's OWN `<svg>` child: the shell moves the palette,
 * with its icon `<svg>`s, in front of it inside the same container.
 */
export function saveSVG(
  canvas: Canvas,
  bounds: Pick<ContentBounds, 'contentBounds'>,
): { svg: string } {
  const source = [...canvas.getContainer().children].find(
    (child): child is SVGSVGElement => child instanceof SVGSVGElement,
  );
  if (!source) throw new Error('No SVG found in the canvas container.');
  const box = bounds.contentBounds(EXPORT_PADDING) ?? EMPTY_EXPORT;
  const clone = source.cloneNode(true) as SVGSVGElement;
  for (const attribute of LIVE_CANVAS_ATTRIBUTES) clone.removeAttribute(attribute);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
  clone.setAttribute('width', String(box.width));
  clone.setAttribute('height', String(box.height));
  clone.querySelector<SVGGElement>('.viewport')?.removeAttribute('transform');
  for (const helper of clone.querySelectorAll('.djs-outline, .djs-hit')) {
    helper.remove();
  }
  const svg = new XMLSerializer().serializeToString(clone);
  return { svg: `<?xml version="1.0" encoding="utf-8"?>\n${svg}` };
}
