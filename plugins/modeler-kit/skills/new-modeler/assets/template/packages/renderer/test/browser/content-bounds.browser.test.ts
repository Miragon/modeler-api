import { afterEach, describe, expect, it } from 'vitest';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import { attachedHost } from '@miragon/modeler-api/conformance';
import type { ElementBounds } from '@miragon/modeler-api';
import {
  createCollaborativeModeler,
  createCollaborativeViewer,
  type CollaborativeDiagram,
} from '../../src/index.js';
import orders from './fixtures/orders.__EXT__?raw';

const mounted: Array<{ modeler: CollaborativeDiagram; host: HTMLElement }> = [];

afterEach(() => {
  for (const { modeler, host } of mounted.splice(0)) {
    modeler.destroy();
    host.parentElement?.remove();
  }
});

function attached(modeler: CollaborativeDiagram): CollaborativeDiagram {
  const host = attachedHost();
  modeler.attachTo(host);
  mounted.push({ modeler, host });
  return modeler;
}

function union(boxes: readonly ElementBounds[]): ElementBounds {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function contains(outer: ElementBounds, inner: ElementBounds): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function viewBoxOf(svg: string): ElementBounds {
  const [x = NaN, y = NaN, width = NaN, height = NaN] = new DOMParser()
    .parseFromString(svg, 'image/svg+xml')
    .documentElement.getAttribute('viewBox')!
    .split(' ')
    .map(Number);
  return { x, y, width, height };
}

const LONG_LABEL = Array.from({ length: 25 }, (_, index) => `word${index + 1}`).join(' ');

const MOUNTS = [
  ['modeler', createCollaborativeModeler],
  ['viewer', createCollaborativeViewer],
] as const;

for (const [name, create] of MOUNTS) {
  describe(`contentBounds() of the ${name}`, () => {
    it('is undefined while nothing is drawn, before and after an import', async () => {
      const modeler = attached(create());
      expect(modeler.contentBounds()).toBeUndefined();
      await modeler.importText('');
      expect(modeler.contentBounds()).toBeUndefined();
    });

    // The shell's fit insets are the only margin a host adds (guide §5.9).
    it('is the tight box of the nodes, without padding, whatever the view', async () => {
      const modeler = attached(create());
      await modeler.importText(orders);
      const boxes = modeler.elements.list().map(({ id }) => modeler.elements.bounds(id)!);
      expect(boxes).toHaveLength(3);
      const tight = union(boxes);
      expect(modeler.contentBounds()).toEqual(tight);
      modeler.setViewState({ x: -500, y: -300, width: 400, height: 300 });
      expect(modeler.contentBounds()).toEqual(tight);
    });

    // The fit and the SVG export frame the nodes' boxes, so a line drawn outside them is cut off.
    it('covers a label longer than its node, which ends in an ellipsis inside it', async () => {
      const modeler = attached(create());
      await modeler.importText(`node long "${LONG_LABEL}" [40, 40]\n`);
      const node = modeler.elements.bounds('long')!;
      expect(modeler.contentBounds()).toEqual(node);
      const registry = modeler.diagram.get<ElementRegistry>('elementRegistry');
      const visual = registry.getGraphics('long').querySelector<SVGGElement>('.djs-visual')!;
      const { x, y, width, height } = visual.getBBox();
      const drawn = { x: node.x + x, y: node.y + y, width, height };
      expect(contains(node, drawn)).toBe(true);
      const lines = [...visual.querySelectorAll('tspan')].map((line) => line.textContent ?? '');
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.at(-1)).toMatch(/\S…$/);
      expect(
        LONG_LABEL.startsWith(
          lines
            .map((line) => line.trim())
            .join(' ')
            .slice(0, -1),
        ),
      ).toBe(true);
      const exported = viewBoxOf(modeler.diagram.saveSVG().svg);
      expect(contains(exported, drawn)).toBe(true);
    });

    it('is undefined once destroyed', async () => {
      const modeler = attached(create());
      await modeler.importText(orders);
      modeler.destroy();
      expect(modeler.contentBounds()).toBeUndefined();
    });
  });
}
