import { createChromeDialog, element, type ChromeDialog, type DialogChrome } from "./dialog.js";

const DIALOG_CLASS = "cm-title-dialog";
const TITLE_ID = "cm-title-dialog-title";
const FIELD_ID = "cm-title-dialog-field";

/** The map's title, read when the dialog opens and written when it applies. */
export interface MapTitle {
  title(): string;
  setTitle(title: string): void;
}

export type TitleDialogChrome = DialogChrome;
export type TitleDialog = ChromeDialog;

function button(label: string, variant: "primary" | "secondary"): HTMLButtonElement {
  const created = element("button", "cm-dialog-button", label);
  created.type = variant === "primary" ? "submit" : "button";
  created.dataset.variant = variant;
  return created;
}

/**
 * The "Map title…" dialog of the Model group: guide §5.4 keeps form fields out of the menu, so the
 * entry opens a dialog (§8) with the title field, Cancel and Apply. Enter applies, Escape cancels;
 * an unchanged title writes nothing, so the map's history gets no empty step.
 */
export function createTitleDialog(chrome: TitleDialogChrome, mapTitle: MapTitle): TitleDialog {
  const field = element("input", "cm-dialog-input");
  field.id = FIELD_ID;
  field.type = "text";
  field.autocomplete = "off";
  field.spellcheck = false;
  // showModal() focuses the first focusable element, which would be the header's Close button.
  field.autofocus = true;

  return createChromeDialog(chrome, {
    className: DIALOG_CLASS,
    titleId: TITLE_ID,
    title: "Map title",
    beforeOpen() {
      field.value = mapTitle.title();
    },
    afterOpen() {
      field.select();
    },
    content(close) {
      const form = element("form", "cm-dialog-form");
      form.noValidate = true;
      const body = element("div", "cm-dialog-body");
      const label = element("label", "cm-dialog-label", "Title");
      label.htmlFor = FIELD_ID;
      body.append(label, field);
      const footer = element("div", "cm-dialog-footer");
      const cancel = button("Cancel", "secondary");
      cancel.addEventListener("click", close);
      footer.append(cancel, button("Apply", "primary"));
      form.append(body, footer);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const title = field.value.trim();
        close();
        if (title !== mapTitle.title()) mapTitle.setTitle(title);
      });
      return [form];
    },
  });
}
