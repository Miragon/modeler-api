import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultMessages, type ToastRequest } from "../../core/index.js";
import type { DropZoneOptions } from "../types.js";
import { createDropZone, type DropZoneController, type DropZoneState } from "./drop-zone.js";

const zones: DropZoneController[] = [];

afterEach(() => {
  for (const zone of zones.splice(0)) zone.destroy();
  document.body.replaceChildren();
});

interface FakeTransfer {
  types: string[];
  items: { kind: string; type: string }[];
  files: File[];
  dropEffect: string;
}

/** A DataTransfer as a drag shows it: files as items with their MIME types, names readable only on drop. */
function filesTransfer(...files: File[]): FakeTransfer {
  return {
    types: ["Files"],
    items: files.map((file) => ({ kind: "file", type: file.type })),
    files,
    dropEffect: "none",
  };
}

const textTransfer = (): FakeTransfer => ({
  types: ["text/plain"],
  items: [{ kind: "string", type: "text/plain" }],
  files: [],
  dropEffect: "none",
});

function drag(type: string, transfer: FakeTransfer, target: EventTarget = window): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  target.dispatchEvent(event);
  return event;
}

const storm = () => new File(["board"], "board.storm", { type: "" });
const json = () => new File(["{}"], "board.json", { type: "application/json" });
const png = () => new File(["png"], "map.png", { type: "image/png" });
const zip = () => new File(["zip"], "notes.zip", { type: "" });

function dropZone(options: Partial<DropZoneOptions> = {}, lang = "en") {
  const layer = document.createElement("div");
  document.body.append(layer);
  let modal = false;
  const states: DropZoneState[] = [];
  const toasts: ToastRequest[] = [];
  const onDrop = vi.fn();
  const zone = createDropZone({
    ownerDocument: document,
    layer,
    messages: defaultMessages,
    lang,
    options: { accept: [".storm", ".json", ".txt", "application/json"], onDrop, ...options },
    modalOpen: () => modal,
    toast: (request) => {
      toasts.push(request);
      return { dismiss() {} };
    },
    setState: (state) => states.push(state),
  });
  zones.push(zone);
  const chip = () => zone.element.querySelector(".cd-shell-drop-zone-chip")?.textContent;
  return {
    zone,
    layer,
    states,
    toasts,
    onDrop,
    chip,
    openModal: () => {
      modal = true;
    },
  };
}

describe("drop zone (guide §9)", () => {
  it("is a hidden, aria-hidden overlay in the layer", () => {
    const { zone, layer } = dropZone();
    expect(zone.element.parentElement).toBe(layer);
    expect(zone.element.className).toBe("cd-shell-drop-zone");
    expect(zone.element.getAttribute("data-chrome")).toBe("drop-zone");
    expect(zone.element.getAttribute("aria-hidden")).toBe("true");
    expect(zone.element.hidden).toBe(true);
    expect(zone.state()).toBeNull();
  });

  it("shows a file drag as over, with the chip and a copy effect", () => {
    const { zone, states, chip } = dropZone();
    const transfer = filesTransfer(storm());
    const event = drag("dragenter", transfer);
    expect(event.defaultPrevented).toBe(true);
    expect(zone.state()).toBe("over");
    expect(zone.element.hidden).toBe(false);
    expect(zone.element.getAttribute("data-state")).toBe("over");
    expect(chip()).toBe("Drop file here");
    expect(transfer.dropEffect).toBe("copy");
    expect(states).toEqual(["over"]);

    expect(drag("dragover", transfer).defaultPrevented).toBe(true);
    expect(transfer.dropEffect).toBe("copy");
    expect(states).toEqual(["over"]);
  });

  it("hears drags anywhere on the page", () => {
    const { zone } = dropZone();
    const inner = document.createElement("div");
    document.body.append(inner);
    drag("dragenter", filesTransfer(storm()), inner);
    expect(zone.state()).toBe("over");
  });

  it("counts only the outermost dragenter and dragleave", () => {
    const { zone, states } = dropZone();
    const transfer = filesTransfer(storm());
    drag("dragenter", transfer);
    drag("dragenter", transfer);
    drag("dragleave", transfer);
    expect(zone.state()).toBe("over");
    expect(drag("dragleave", transfer).defaultPrevented).toBe(true);
    expect(zone.state()).toBeNull();
    expect(zone.element.hidden).toBe(true);
    expect(zone.element.hasAttribute("data-state")).toBe(false);
    expect(states).toEqual(["over", null]);
    drag("dragleave", transfer);
    expect(states).toEqual(["over", null]);
  });

  it("shows a drag that entered before it listened as soon as it moves", () => {
    const { zone } = dropZone();
    const transfer = filesTransfer(storm());
    drag("dragover", transfer);
    expect(zone.state()).toBe("over");
    drag("dragleave", transfer);
    expect(zone.state()).toBeNull();
  });

  it("leaves drags without files alone", () => {
    const { zone, states, onDrop } = dropZone();
    const transfer = textTransfer();
    for (const type of ["dragenter", "dragover", "drop"]) {
      expect(drag(type, transfer).defaultPrevented).toBe(false);
    }
    expect(zone.state()).toBeNull();
    expect(states).toEqual([]);
    expect(transfer.dropEffect).toBe("none");
    expect(onDrop).not.toHaveBeenCalled();
  });

  it.each([
    ["multiple", () => filesTransfer(storm(), json()), {}, "Drop one file at a time"],
    ["type", () => filesTransfer(png()), {}, "This modeler can't open this file type"],
  ] as const)("forbids a drag for %s", (reason, transfer, options, text) => {
    const { zone, chip } = dropZone(options);
    const dragged = transfer();
    expect(drag("dragenter", dragged).defaultPrevented).toBe(true);
    expect(zone.state()).toBe("forbidden");
    expect(zone.element.getAttribute("data-state")).toBe("forbidden");
    expect(chip()).toBe(text);
    expect(chip()).toBe(defaultMessages.dropForbidden(reason));
    expect(dragged.dropEffect).toBe("none");
  });

  it("forbids a drag while a modal dialog is open, and follows the dialog while dragging", () => {
    const { zone, chip, openModal } = dropZone();
    const transfer = filesTransfer(storm());
    drag("dragenter", transfer);
    expect(zone.state()).toBe("over");
    openModal();
    drag("dragover", transfer);
    expect(zone.state()).toBe("forbidden");
    expect(chip()).toBe("Close the dialog to drop a file");
    expect(transfer.dropEffect).toBe("none");
  });

  it("allows several files with multiple", () => {
    const { zone } = dropZone({ multiple: true });
    drag("dragenter", filesTransfer(storm(), json()));
    expect(zone.state()).toBe("over");
  });

  it("hands the accepted files to onDrop and hides", () => {
    const { zone, onDrop, toasts, states } = dropZone();
    const file = storm();
    const transfer = filesTransfer(file);
    drag("dragenter", transfer);
    expect(drag("drop", transfer).defaultPrevented).toBe(true);
    expect(onDrop).toHaveBeenCalledWith([file]);
    expect(toasts).toEqual([]);
    expect(zone.state()).toBeNull();
    expect(states).toEqual(["over", null]);
  });

  it("splits several files into onDrop and onReject", () => {
    const onReject = vi.fn();
    const { onDrop, toasts } = dropZone({ multiple: true, onReject });
    const [first, other, second] = [storm(), zip(), json()];
    drag("drop", filesTransfer(first, other, second));
    expect(onDrop).toHaveBeenCalledWith([first, second]);
    expect(onReject).toHaveBeenCalledWith([other]);
    expect(toasts).toEqual([]);
  });

  it("says by default which files it opens, in a danger toast", () => {
    const { onDrop, toasts } = dropZone();
    drag("drop", filesTransfer(zip()));
    expect(onDrop).not.toHaveBeenCalled();
    expect(toasts).toEqual([
      { status: "danger", text: "Couldn't open “notes.zip”. Drop a .storm, .json, or .txt file." },
    ]);
  });

  it("joins the extensions in the tool's language", () => {
    const { toasts } = dropZone({}, "de");
    drag("drop", filesTransfer(zip()));
    expect(toasts[0]?.text).toBe("Couldn't open “notes.zip”. Drop a .storm, .json oder .txt file.");
  });

  it("rejects a dropped file of a foreign type and opens nothing", () => {
    const { onDrop, toasts } = dropZone();
    drag("dragenter", filesTransfer(png()));
    drag("drop", filesTransfer(png()));
    expect(onDrop).not.toHaveBeenCalled();
    expect(toasts.map((toast) => toast.text)).toEqual([
      "Couldn't open “map.png”. Drop a .storm, .json, or .txt file.",
    ]);
  });

  it("opens nothing on a drop forbidden for multiple or a dialog", () => {
    const onReject = vi.fn();
    const multiple = dropZone({ onReject });
    drag("drop", filesTransfer(storm(), json()));
    expect(multiple.onDrop).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
    multiple.zone.destroy();

    const dialog = dropZone({ onReject });
    dialog.openModal();
    expect(drag("drop", filesTransfer(storm())).defaultPrevented).toBe(true);
    expect(dialog.onDrop).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
    expect(dialog.toasts).toEqual([]);
  });

  it("accepts every file with an empty accept", () => {
    const { onDrop } = dropZone({ accept: [] });
    const file = png();
    drag("dragenter", filesTransfer(file));
    drag("drop", filesTransfer(file));
    expect(onDrop).toHaveBeenCalledWith([file]);
  });

  it("removes its listeners, its overlay and its state on destroy", () => {
    const { zone, states, onDrop } = dropZone();
    const transfer = filesTransfer(storm());
    drag("dragenter", transfer);
    zone.destroy();
    expect(states).toEqual(["over", null]);
    expect(zone.element.isConnected).toBe(false);
    expect(zone.state()).toBeNull();
    expect(drag("dragenter", transfer).defaultPrevented).toBe(false);
    expect(drag("drop", transfer).defaultPrevented).toBe(false);
    expect(onDrop).not.toHaveBeenCalled();
    expect(states).toEqual(["over", null]);
  });
});
