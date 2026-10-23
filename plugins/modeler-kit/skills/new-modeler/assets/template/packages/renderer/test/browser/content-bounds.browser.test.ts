import { afterEach, describe, expect, it } from 'vitest';
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

    it('is undefined once destroyed', async () => {
      const modeler = attached(create());
      await modeler.importText(orders);
      modeler.destroy();
      expect(modeler.contentBounds()).toBeUndefined();
    });
  });
}
