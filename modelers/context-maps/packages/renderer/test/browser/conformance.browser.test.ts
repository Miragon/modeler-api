import { afterAll, afterEach, describe, expect, test } from "vitest";
import {
  attachedHost,
  registerConformance,
  type ConformanceHarness,
} from "@miragon/modeler-api/conformance";
import type { CollaborativeModeler } from "@miragon/modeler-api";
import type Canvas from "diagram-js/lib/core/Canvas";
import type CommandStack from "diagram-js/lib/command/CommandStack";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type Modeling from "diagram-js/lib/features/modeling/Modeling";
import type { Shape } from "diagram-js/lib/model/Types";
import {
  createCollaborativeModeler,
  createCollaborativeViewer,
  type CmContext,
  type CmElementFactory,
  type CmLabelEditing,
  type CollaborativeContextMapsModeler,
} from "@miragon/context-maps-renderer";
import conferencePlanner from "./fixtures/conference-planner.cm?raw";
import conferencePlannerLoose from "./fixtures/conference-planner.loose.cm?raw";
import orderFulfilment from "./fixtures/order-fulfilment.cm?raw";
import orderFulfilmentLoose from "./fixtures/order-fulfilment.loose.cm?raw";
import orderFulfilmentForeign from "./fixtures/order-fulfilment.foreign.cm?raw";

const hostWrappers: HTMLElement[] = [];

afterEach(() => {
  for (const wrapper of hostWrappers.splice(0)) wrapper.remove();
});

function mountedHost(): HTMLElement {
  const host = attachedHost();
  if (host.parentElement) hostWrappers.push(host.parentElement);
  return host;
}

function diagramOf(modeler: CollaborativeModeler): CollaborativeContextMapsModeler["diagram"] {
  return (modeler as CollaborativeContextMapsModeler).diagram;
}

// Shared across instances: every call creates a context of its own name, so the kit's collision
// case compares the ids two peers allocate for different contexts.
let createdContexts = 0;

function addContext(modeler: CollaborativeModeler): void {
  const diagram = diagramOf(modeler);
  createdContexts += 1;
  const context = diagram
    .get<CmElementFactory>("cmElementFactory")
    .createNewContext("core", `New context ${createdContexts}`);
  diagram
    .get<Modeling>("modeling")
    .createShape(
      context as unknown as Shape,
      { x: 1200, y: 700 },
      diagram.get<Canvas>("canvas").getRootElement() as Shape,
    );
}

let renamed = 0;

function renameMap(modeler: CollaborativeModeler): void {
  renamed += 1;
  diagramOf(modeler).setMeta({ title: `Renamed map ${renamed}` });
}

/** The canonical text with one fragment replaced by what a peer typed so far. */
function typedHalfway(fragment: string, typedSoFar: string): string {
  if (!conferencePlanner.includes(fragment)) throw new Error(`the fixture lost "${fragment}"`);
  return conferencePlanner.replace(fragment, typedSoFar);
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
  canonicalTexts: [conferencePlanner, orderFulfilment],
  looseTexts: [conferencePlannerLoose, orderFulfilmentLoose],
  invalidTexts: [
    "{",
    "not a context map",
    "[]",
    '{ "version": 2, "title": "From the future", "contexts": [], "relationships": [] }',
    typedHalfway('"id": "ctx_cfp"', '"id": "ctx_auth"'),
    typedHalfway('"id": "ctx_cfp"', '"id": "cm-root"'),
    typedHalfway('"x": 340', '"x": 1e38'),
    typedHalfway('"pattern": "shared-kernel"', '"pattern": "shared'),
  ],
  // damaged forms the parser meets while a peer types, on top of the probes the kit derives
  probeTexts: [
    typedHalfway('"x": 340,', '"x": 34'),
    typedHalfway('"label": "identity"', '"label": "iden'),
    typedHalfway('"subdomainType": "core"', '"subdomainType": "co"'),
    typedHalfway('"to": "ctx_cfp"', '"to": "ctx_'),
  ],
  foreignTexts: [
    {
      text: orderFulfilmentForeign,
      mustSurvive: [
        '"x-vendor": {',
        '"x-repository": "git@example.com:shop/ordering.git"',
        '"x-weight": 3',
      ],
    },
  ],
  viewState: { x: 120, y: 80, width: 640, height: 480 },
  mutate: addContext,
  configMutations: [{ name: "title", run: renameMap }],
  undo: (modeler) => diagramOf(modeler).get<CommandStack>("commandStack").undo(),
  redo: (modeler) => diagramOf(modeler).get<CommandStack>("commandStack").redo(),
  settle: () => new Promise((resolve) => setTimeout(resolve, 30)),
  openInteraction(modeler) {
    const diagram = diagramOf(modeler);
    const context = diagram.get<ElementRegistry>("elementRegistry").get("ctx_cfp");
    if (!context) throw new Error("the imported map has no context ctx_cfp to rename");
    diagram.get<CmLabelEditing>("cmLabelEditing").activate(context as unknown as CmContext);
    const field = diagram
      .get<Canvas>("canvas")
      .getContainer()
      .querySelector<HTMLElement>(".djs-direct-editing-content");
    if (!field) throw new Error("no label editor opened");
    field.innerText = "typed, not committed";
  },
  interactionState(modeler) {
    const edit = diagramOf(modeler).get<CmLabelEditing>("cmLabelEditing").openEdit();
    return edit && { elementId: edit.elementId, text: edit.text };
  },
};

// No case is inapplicable to Context Maps: the harness fills every optional hook. A skip is
// therefore a gap in the harness.
const failOnSkip = {
  onSkip(caseName: string, reason: string): never {
    throw new Error(`conformance case skipped: "${caseName}" — ${reason}`);
  },
};

const advisories: string[] = [];

describe("Context Maps implements the collaborative-modeler contract", () => {
  registerConformance(harness, test, {
    ...failOnSkip,
    onAdvisory(caseName, advice) {
      advisories.push(`${caseName}: ${advice}`);
    },
  });

  // Random ids (ctx_<nanoid>) never collide across peers, and a label edit survives a re-import:
  // the kit's recommendations are all met.
  afterAll(() => {
    expect(advisories).toEqual([]);
  });
});
