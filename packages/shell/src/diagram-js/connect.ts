import type { Bounds } from "../core/index.js";
import type { ShellHandle } from "../dom/index.js";
import { shellServiceOf } from "./service.js";
import type { DiagramEventListener, EventBusLike, InjectorLike } from "./types.js";
import { DiagramViewport, type Viewport } from "./viewport.js";

/**
 * What `connectDiagramJs` reads of a renderer's `@miragon/modeler-api` contract instance
 * (`createCollaborativeModeler(…)`), typed structurally like the diagram-js services: the content
 * bounds the contract reports since 1.3.
 */
export interface CollaborativeModelerLike {
  contentBounds?(): Bounds | undefined;
}

export interface ConnectOptions {
  /**
   * The renderer's contract instance. Its `contentBounds()` (`@miragon/modeler-api` 1.3) is what
   * the viewport fits to unless `contentBounds` is given.
   */
  modeler?: CollaborativeModelerLike | undefined;
  /**
   * Content bounds in diagram coordinates, tight around the content: the fit insets are the only
   * margin (guide §5.9). `undefined` = nothing to fit (empty file). Default: `modeler.contentBounds()`;
   * given, it wins, for a renderer before contract 1.3 or a host that fits to other bounds. One of
   * the two is required.
   */
  contentBounds?: (() => Bounds | undefined) | undefined;
  /**
   * An empty file (guide §13.5: no element, only whitespace, comments or a title), which shows the
   * empty-file hint. Default: `contentBounds()` is empty. A notation whose bounds are never empty
   * (Wardley's plot) passes its own test.
   */
  isEmpty?: (() => boolean) | undefined;
  prefersReducedMotion?: (() => boolean) | undefined;
}

export interface DiagramJsConnection {
  readonly viewport: Viewport;
  /**
   * Unbinds viewport, palette, keys and the hint sync from the shell; destroys neither the diagram
   * nor the shell. Runs by itself on `diagram.destroy`.
   */
  destroy(): void;
}

/** After the viewport's own listeners, so its content state is fresh when the hint reads it. */
const HINT_SYNC_PRIORITY = 500;

/** The host's `contentBounds`, else the contract's; throws when neither is there. */
function contentBoundsOf(options: ConnectOptions): () => Bounds | undefined {
  if (options.contentBounds) return () => options.contentBounds?.();
  const { modeler } = options;
  if (typeof modeler?.contentBounds === "function") return () => modeler.contentBounds?.();
  throw new Error(
    "@miragon/modeler-shell: connectDiagramJs needs the content bounds: pass options.contentBounds, or options.modeler with contentBounds() (@miragon/modeler-api 1.3)",
  );
}

/**
 * Connects a diagram built with `shellModule` to a mounted shell: creates the viewport with
 * `shell.fitInsets` and the content bounds (`options.contentBounds`, else the contract's
 * `options.modeler.contentBounds()`), binds it with `shell.setZoomTarget`, registers the palette
 * (`shell.registerPalette`), keeps the empty-file hint in sync with the diagram (after every
 * `import.done` and `elements.changed`, so the first element created on the canvas hides it) and
 * calls `canvas.resized()`. Throws when `shellModule` or the content bounds are missing.
 */
export function connectDiagramJs(
  shell: ShellHandle,
  diagram: InjectorLike,
  options: ConnectOptions,
): DiagramJsConnection {
  const service = shellServiceOf(diagram);
  const contentBounds = contentBoundsOf(options);
  const eventBus = diagram.get<EventBusLike>("eventBus");
  const prefersReducedMotion = options.prefersReducedMotion?.bind(options);
  const viewport = new DiagramViewport(diagram, {
    contentBounds,
    insets: () => shell.fitInsets(),
    ...(prefersReducedMotion ? { prefersReducedMotion } : {}),
  });
  shell.setZoomTarget(viewport);
  const detachPalette = service.attachShell(shell);
  // The shell has moved the canvas element into its slot; diagram-js caches the old size.
  viewport.resized();

  const isEmpty = options.isEmpty ? () => options.isEmpty?.() === true : () => !viewport.canFit();
  const syncHint: DiagramEventListener = () => shell.setEmptyHint(isEmpty());
  eventBus.on(["import.done", "elements.changed"], HINT_SYNC_PRIORITY, syncHint);

  let destroyed = false;
  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    eventBus.off(["import.done", "elements.changed"], syncHint);
    eventBus.off("diagram.destroy", destroy);
    detachPalette();
    shell.setZoomTarget(null);
    viewport.destroy();
  };
  eventBus.on("diagram.destroy", destroy);
  return { viewport, destroy };
}
