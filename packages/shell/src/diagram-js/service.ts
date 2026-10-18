import { defaultMessages, matchChromeKey } from "../core/index.js";
import type { ShellHandle } from "../dom/index.js";
import { PaletteSkin, type PaletteEntryLike } from "./palette-skin.js";
import type {
  CanvasLike,
  DiagramEventListener,
  EventBusLike,
  InjectorLike,
  KeyboardLike,
  PaletteLike,
} from "./types.js";

/** The didi name of the service `shellModule` registers. */
export const SHELL_SERVICE = "modelerShell";

/** Above `KeyboardBindings` and the modelers' keyboard modules (default priority 1000). */
export const KEYBOARD_PRIORITY = 2000;

/** Ahead of every default-priority `palette.trigger` listener, so the read-only veto comes first. */
const TRIGGER_PRIORITY = 2000;

/** A palette without a shell is editable. */
const EDITABLE = { locked: false, shown: false } as const;

/** didi's injector, which resolves a missing service to `null` with `strict: false`. */
interface DidiInjectorLike {
  get(name: string, strict?: boolean): unknown;
}

interface KeyboardEventContext {
  keyEvent?: KeyboardEvent;
}

interface PaletteTriggerEvent {
  entry?: PaletteEntryLike;
  event?: Event;
}

/**
 * The diagram-side half of `shellModule`: the palette skin, the chrome-key guard on the diagram-js
 * keyboard and the buffer that holds the palette until `connectDiagramJs` hands it to a shell.
 */
export class ShellDiagramService {
  static $inject = ["eventBus", "injector"];

  private svg: Element | undefined;
  private skin: PaletteSkin | undefined;
  private activeTool: string | null = null;
  private shell: ShellHandle | undefined;
  private unregisterPalette: (() => void) | undefined;
  private readonly subscriptions: Array<readonly [string, DiagramEventListener]> = [];
  private destroyed = false;

  constructor(
    private readonly eventBus: EventBusLike,
    private readonly injector: DidiInjectorLike,
  ) {
    this.subscribe("canvas.init", (event: { svg?: Element }) => {
      this.svg = event.svg;
    });
    this.subscribe("palette.create", (event: { container: HTMLElement }) =>
      this.onPaletteCreate(event.container),
    );
    this.subscribe("palette.changed", () => this.skin?.refresh());
    this.subscribe("tool-manager.update", (event: { tool?: string | null }) => {
      this.activeTool = event.tool ?? null;
      this.skin?.setActiveTool(this.activeTool);
    });
    this.subscribe("palette.trigger", this.onPaletteTrigger, TRIGGER_PRIORITY);
    this.subscribe("diagram.destroy", () => this.destroy());

    const keyboard = injector.get("keyboard", false) as KeyboardLike | null;
    if (keyboard) {
      keyboard.addListener(KEYBOARD_PRIORITY, this.onKeyboardKeydown);
      this.subscriptions.push(["keyboard.keydown", this.onKeyboardKeydown]);
    }
  }

  /**
   * Hands the palette (now or once diagram-js creates it) to `shell`; returns the detach
   * function. A later call replaces the earlier shell.
   */
  attachShell(shell: ShellHandle): () => void {
    this.detachShell();
    if (this.destroyed) return () => undefined;
    this.shell = shell;
    this.skin?.setLabel(shell.messages.tools);
    this.registerPalette();
    return () => {
      if (this.shell === shell) this.detachShell();
    };
  }

  private registerPalette(): void {
    const { shell, skin } = this;
    if (!shell || !skin) return;
    this.unregisterPalette?.();
    this.unregisterPalette = shell.registerPalette({
      element: skin.element,
      entryTooltip: (entry) => skin.entryTooltip(entry),
      setReadOnly: (state) => skin.setReadOnly(state),
    });
  }

  private detachShell(): void {
    const unregister = this.unregisterPalette;
    this.unregisterPalette = undefined;
    this.shell = undefined;
    unregister?.();
    this.skin?.setReadOnly(EDITABLE);
    this.skin?.setLabel(defaultMessages.tools);
  }

  private onPaletteCreate(container: HTMLElement): void {
    this.skin?.destroy();
    const palette = this.injector.get("palette", false) as PaletteLike | null;
    const skin = new PaletteSkin(container, () => palette?.getEntries() ?? {});
    this.skin = skin;
    skin.setActiveTool(this.activeTool);
    if (this.shell) skin.setLabel(this.shell.messages.tools);
    this.moveBeforeCanvas(container);
    this.registerPalette();
  }

  // Palette#_init appends the palette after the <svg>; in front of it the palette comes first in
  // the tab order (guide §5.14).
  private moveBeforeCanvas(container: HTMLElement): void {
    const parent = container.parentElement ?? this.canvasContainer();
    if (!parent) return;
    const svg =
      this.svg?.parentNode === parent
        ? this.svg
        : Array.from(parent.children).find((child) => child.localName === "svg");
    if (svg) parent.insertBefore(container, svg);
  }

  private canvasContainer(): HTMLElement | undefined {
    const canvas = this.injector.get("canvas", false) as CanvasLike | null;
    return canvas?.getContainer();
  }

  private readonly onPaletteTrigger = (event: PaletteTriggerEvent): false | undefined => {
    if (!event.entry || !this.skin?.vetoes(event.entry, event.event)) return undefined;
    // A vetoed dragstart would otherwise still start the browser's native drag of the entry.
    event.event?.preventDefault();
    return false;
  };

  private readonly onKeyboardKeydown = (context: KeyboardEventContext): true | undefined =>
    context.keyEvent && matchChromeKey(context.keyEvent) ? true : undefined;

  private subscribe<E>(name: string, listener: (event: E) => unknown, priority?: number): void {
    const handler = listener as DiagramEventListener;
    if (priority === undefined) this.eventBus.on(name, handler);
    else this.eventBus.on(name, priority, handler);
    this.subscriptions.push([name, handler]);
  }

  private destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.detachShell();
    this.skin?.destroy();
    this.skin = undefined;
    this.svg = undefined;
    for (const [name, listener] of this.subscriptions.splice(0)) this.eventBus.off(name, listener);
  }
}

/** The service of `shellModule` in `diagram`; throws when the modeler was built without it. */
export function shellServiceOf(diagram: InjectorLike): ShellDiagramService {
  let service: unknown;
  try {
    service = diagram.get<unknown>(SHELL_SERVICE);
  } catch {
    service = undefined;
  }
  if (!isShellService(service)) {
    throw new Error(
      "@miragon/modeler-shell: connectDiagramJs needs shellModule in the modeler's modules (additionalModules: [shellModule])",
    );
  }
  return service;
}

// Duck-typed rather than `instanceof`, so a shellModule from the CJS build connects to the ESM one.
function isShellService(value: unknown): value is ShellDiagramService {
  return typeof (value as Partial<ShellDiagramService> | null)?.attachShell === "function";
}
