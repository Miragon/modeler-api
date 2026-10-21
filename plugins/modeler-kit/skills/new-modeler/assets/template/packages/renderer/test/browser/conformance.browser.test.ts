import { afterAll, afterEach, describe, expect, test } from 'vitest';
import {
  attachedHost,
  registerConformance,
  type ConformanceHarness,
} from '@miragon/modeler-api/conformance';
import type { CollaborativeModeler } from '@miragon/modeler-api';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type { Shape } from 'diagram-js/lib/model/Types';
import {
  createCollaborativeModeler,
  createCollaborativeViewer,
  type CollaborativeDiagram,
  type DomainModeling,
  type LabelEditing,
  type NodeFactory,
  type NodeShape,
} from '../../src/index.js';
import orders from './fixtures/orders.__EXT__?raw';
import ordersLoose from './fixtures/orders.loose.__EXT__?raw';
import ordersForeign from './fixtures/orders.foreign.__EXT__?raw';
import payments from './fixtures/payments.__EXT__?raw';

const hosts: HTMLElement[] = [];

afterEach(() => {
  for (const host of hosts.splice(0)) host.parentElement?.remove();
});

function mountedHost(): HTMLElement {
  const host = attachedHost();
  hosts.push(host);
  return host;
}

function diagramOf(modeler: CollaborativeModeler): CollaborativeDiagram['diagram'] {
  return (modeler as CollaborativeDiagram).diagram;
}

// Shared across instances: every call creates a node with a label of its own, so the kit's
// collision case compares the ids two peers allocate for DIFFERENT elements.
let createdNodes = 0;

function addNode(modeler: CollaborativeModeler): void {
  const diagram = diagramOf(modeler);
  createdNodes += 1;
  const node = diagram.get<NodeFactory>('nodeFactory').createNew(`Node ${createdNodes}`);
  const root = diagram.get<Canvas>('canvas').getRootElement() as Shape;
  diagram.get<Modeling>('modeling').createShape(node, { x: 900, y: 500 }, root);
}

function nodeToEdit(modeler: CollaborativeModeler): NodeShape {
  const node = diagramOf(modeler).get<ElementRegistry>('elementRegistry').get('order');
  if (!node) throw new Error('the imported document has no node "order"');
  return node as NodeShape;
}

function labelField(modeler: CollaborativeModeler): HTMLTextAreaElement {
  const field = diagramOf(modeler)
    .get<Canvas>('canvas')
    .getContainer()
    .querySelector<HTMLTextAreaElement>('textarea.diagram-label-editor');
  if (!field) throw new Error('no label editor is open');
  return field;
}

const harness: ConformanceHarness = {
  async create() {
    const modeler = createCollaborativeModeler();
    modeler.attachTo(mountedHost());
    return modeler;
  },
  async createReadonly() {
    const viewer = createCollaborativeViewer();
    viewer.attachTo(mountedHost());
    return viewer;
  },
  // Two DISTINCT texts, reviewed byte by byte: the undo law needs a second document.
  canonicalTexts: [orders, payments],
  looseTexts: [ordersLoose],
  invalidTexts: ['node order "Twice" [0, 0]\nnode order "Twice" [200, 0]\n'],
  foreignTexts: [
    { text: ordersForeign, mustSurvive: ['x-vendor: keep-me', '# owner team-orders'] },
  ],
  // damaged forms the parser meets while a peer types, on top of the probes the kit derives
  probeTexts: ['node order "Place', 'node order "Place order" [40,', 'title'],
  viewState: { x: 120, y: 80, width: 640, height: 480 },
  mutate: addNode,
  configMutations: [
    {
      name: 'title',
      run: (modeler) => {
        const modeling = diagramOf(modeler).get<DomainModeling>('domainModeling');
        modeling.setTitle(`${modeling.getTitle() ?? 'Untitled'} (edited)`);
      },
    },
  ],
  undo: (modeler) => diagramOf(modeler).get<CommandStack>('commandStack').undo(),
  redo: (modeler) => diagramOf(modeler).get<CommandStack>('commandStack').redo(),
  moveElement(modeler) {
    const node = nodeToEdit(modeler);
    diagramOf(modeler).get<Modeling>('modeling').moveElements([node], { x: 160, y: 120 });
    return node.id;
  },
  // The same input on every call: the kit compares the commit with and without a view change.
  openInteraction(modeler) {
    diagramOf(modeler).get<LabelEditing>('labelEditing').activate(nodeToEdit(modeler));
    labelField(modeler).value = 'typed, not committed';
  },
  interactionState: (modeler) => diagramOf(modeler).get<LabelEditing>('labelEditing').openEdit(),
  commitInteraction(modeler) {
    labelField(modeler).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
  },
  settle: () => new Promise((resolve) => setTimeout(resolve, 30)),
};

const advisories: string[] = [];

describe('the renderer implements the collaborative-modeler contract', () => {
  // Every hook is filled, so a skip is a gap of this harness; a new case of a later kit release
  // names the field it needs.
  registerConformance(harness, test, {
    onSkip(caseName, reason) {
      throw new Error(`conformance case skipped: "${caseName}": ${reason}`);
    },
    onAdvisory(caseName, advice) {
      advisories.push(`${caseName}: ${advice}`);
    },
  });

  // The renderer follows every recommendation, so an advisory is a regression to look at.
  afterAll(() => {
    expect(advisories).toEqual([]);
  });
});
