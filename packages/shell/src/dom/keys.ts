import { TEXT_FIELD_SELECTOR, decideKey, type ChromeKey, type ShellHost } from "../core/index.js";

export interface KeyListenerContext {
  host: ShellHost;
  /** Where dialogs and popovers count: the document in an own document, else the shell root. */
  dialogScope: ParentNode;
  menuOpen(): boolean;
  closeMenu(): void;
  hideTooltip(): void;
  run(key: ChromeKey): void;
}

function isTextField(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  const element = target as HTMLElement;
  return element.isContentEditable === true || element.closest(TEXT_FIELD_SELECTOR) !== null;
}

// A dialog a modeler hides through CSS (a class with display: none) is closed as well.
function isShown(element: Element): boolean {
  if (element.localName === "dialog" && !element.hasAttribute("open")) return false;
  if (element.closest("[hidden]")) return false;
  return (
    typeof element.checkVisibility !== "function" || element.checkVisibility({ visibilityProperty: true })
  );
}

function isModal(element: Element): boolean {
  if (element.getAttribute("aria-modal") === "true") return true;
  try {
    return element.matches(":modal");
  } catch {
    return false;
  }
}

function openDialogs(scope: ParentNode): Element[] {
  return [...scope.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog')].filter(isShown);
}

/** The shell's one `keydown` listener (bubble phase): applies `decideKey` (guide §5.8, §13.5). */
export function createKeyListener(context: KeyListenerContext): (event: KeyboardEvent) => void {
  return (event) => {
    if (event.key === "Escape") context.hideTooltip();
    const dialogs = openDialogs(context.dialogScope);
    const decision = decideKey(event, {
      host: context.host,
      inTextField: isTextField(event.target),
      menuOpen: context.menuOpen(),
      dialogOpen: dialogs.length > 0,
      modalOpen: dialogs.some(isModal),
      defaultPrevented: event.defaultPrevented,
    });
    if (decision.preventDefault) event.preventDefault();
    if (decision.stopPropagation) event.stopPropagation();
    if (decision.action === "closeMenu") context.closeMenu();
    else if (decision.action) context.run(decision.action);
  };
}
