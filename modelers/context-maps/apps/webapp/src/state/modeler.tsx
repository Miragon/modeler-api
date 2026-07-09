/**
 * React glue around the framework-agnostic diagram-js `Modeler`. Creates a
 * single modeler instance, mirrors its events (selection, history, changes)
 * into React state, drives autosave, and provides it via context so the chrome
 * (menu, inspector, share) can drive the canvas. The context + hook live in
 * `modelerContext.ts` so this file exports only a component (Fast Refresh safe).
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modeler, isCmElement } from "@miragon/context-maps-renderer";
import { saveToStorage } from "./persistence";
import { writeDocumentToLocation } from "@/io/url";
import { ModelerContext, type ModelerContextValue, type Selected } from "./modelerContext";

export function ModelerProvider({ children }: { children: ReactNode }) {
  const modelerRef = useRef<Modeler>(undefined);
  // Fill the full-bleed `.tt-canvas` host. Without an explicit height the
  // renderer falls back to its standalone 600px default (it's created detached
  // and only attached later via `attachTo`, so it can't infer the host size).
  if (!modelerRef.current) modelerRef.current = new Modeler({ height: "100%" });
  const modeler = modelerRef.current;
  // Dev affordance: expose the modeler for debugging / automation.
  if (import.meta.env.DEV) (window as unknown as { __cmModeler?: Modeler }).__cmModeler = modeler;

  const [selected, setSelected] = useState<Selected>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [title, setTitleState] = useState("Untitled context map");
  const [revision, setRevision] = useState(0);

  // Debounced autosave of the current document: to localStorage (so a refresh
  // never loses work) and into the address-bar hash (so the URL is always a
  // shareable/bookmarkable snapshot, no Share click required).
  //
  // Save SYNCHRONOUSLY on every change (commands are user-discrete — a drop, a
  // create, a property edit — not high-frequency), so there is never a pending,
  // unsaved state that a quick reload could lose. localStorage + URL stay in
  // lockstep, which matters because restore prefers the URL over localStorage.
  const saveNow = () => {
    const doc = modeler.exportDocument();
    saveToStorage(doc);
    writeDocumentToLocation(doc);
  };
  const persist = saveNow;

  useEffect(() => {
    const syncHistory = () => {
      setCanUndo(modeler.canUndo());
      setCanRedo(modeler.canRedo());
    };
    const bump = () => setRevision((r) => r + 1);
    const syncTitle = () => setTitleState(modeler.getMeta()?.title ?? "Untitled context map");

    const onSelection = (e: unknown) => {
      const sel = (e as { newSelection?: unknown[] }).newSelection?.[0];
      setSelected(isCmElement(sel) ? (sel as Selected) : null);
    };
    const onCommandStack = () => {
      syncHistory();
      bump();
      persist();
    };
    const onElements = () => bump();
    const onImport = () => {
      syncHistory();
      syncTitle();
      bump();
      // New / Example / Import-file / shared-link all re-import: keep the
      // autosave + address-bar hash in step with the freshly loaded document.
      persist();
    };

    // Save directly on any structural change (element added/removed), not only
    // via commandStack.changed — so a freshly drawn line is persisted the instant
    // it appears, whatever code path created it. Suppressed during (re-)import.
    let importing = false;
    const onImportStart = () => {
      importing = true;
    };
    const onImportRenderDone = () => {
      importing = false;
    };
    const onStructural = () => {
      if (!importing) saveNow();
    };
    const structuralEvents = [
      "connection.added",
      "shape.added",
      "connection.removed",
      "shape.removed",
    ];

    modeler.on("selection.changed", onSelection);
    modeler.on("commandStack.changed", onCommandStack);
    modeler.on("elements.changed", onElements);
    modeler.on("import.done", onImport);
    modeler.on("import.render.start", onImportStart);
    modeler.on("import.render.done", onImportRenderDone);
    structuralEvents.forEach((ev) => modeler.on(ev, onStructural));

    // Belt-and-suspenders: also save right before the page unloads/hides.
    const flush = () => saveNow();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);

    // Initial sync (the first import.done may fire before we subscribed).
    syncHistory();
    syncTitle();

    return () => {
      modeler.off("selection.changed", onSelection);
      modeler.off("commandStack.changed", onCommandStack);
      modeler.off("elements.changed", onElements);
      modeler.off("import.done", onImport);
      modeler.off("import.render.start", onImportStart);
      modeler.off("import.render.done", onImportRenderDone);
      structuralEvents.forEach((ev) => modeler.off(ev, onStructural));
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeler]);

  const setTitle = (next: string) => {
    modeler.setMeta({ title: next });
    setTitleState(next);
    persist();
  };

  const value = useMemo<ModelerContextValue>(
    () => ({ modeler, selected, canUndo, canRedo, title, revision, setTitle }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modeler, selected, canUndo, canRedo, title, revision],
  );

  return <ModelerContext.Provider value={value}>{children}</ModelerContext.Provider>;
}
