import { ariaKeyShortcutsFromLabel, shortcutKeyKind } from "../core/index.js";

// Key names that are characters: no key of the US or the German layout types them without ⇧, AltGr
// or a dead key, and WAI-ARIA calls the plus key Plus.
const CHARACTER_KEY_NAMES = new Set('!"$%&()*+:>?@^_{|}~');

// KeyboardEvent.code names a key's position, not the key name WAI-ARIA asks for (guide §5.6).
const KEY_CODE_NAME =
  /^(Key[A-Z]|Digit\d|Numpad\w+|Equal|Minus|Slash|Backslash|IntlBackslash|Comma|Period|Semicolon|Quote|Backquote|BracketLeft|BracketRight)$/;

/**
 * Guide §5.6 (design system 1.21.0) for a control that shows the shortcut chip `chip` and carries
 * `keyShortcuts` as `aria-keyshortcuts` (`null` or empty without one):
 * - no chip names a character that needs AltGr or ⌥, sits on a dead key or is missing on the US or
 *   the German layout (`@`, `[`, `ä`), whatever the control carries;
 * - a chip whose character needs ⇧ on one of them carries the keys of both, US first, as
 *   `ariaKeyShortcutsFromLabel` derives them (`?` → `Shift+/ Shift+ß`, the zoom-in chip `⌘+` →
 *   `Meta+= Meta+Plus`), so the chip as description does not do;
 * - `aria-keyshortcuts` names keys, not the characters they type (WAI-ARIA 1.2, a MUST): `?` and
 *   `Shift+?` name a character, `Equal` a KeyboardEvent code.
 * Whether any other chip without `aria-keyshortcuts` reaches assistive technology is the caller's.
 */
export function shortcutChipProblems(
  where: string,
  chip: string,
  keyShortcuts: string | null | undefined,
): string[] {
  const kind = shortcutKeyKind(chip);
  if (kind === "ruledOut") {
    return [
      `${where} shows the shortcut "${chip}" on a character that needs AltGr or ⌥, sits on a dead key or is missing on the US or the German layout; guide §5.6 rules such a shortcut out`,
    ];
  }
  const expected = kind === "shifted" ? ariaKeyShortcutsFromLabel(chip) : undefined;
  if (!keyShortcuts) {
    return expected
      ? [
          `${where} has no aria-keyshortcuts for the chip "${chip}", expected "${expected}": the keys of the US, then the German layout (guide §5.6)`,
        ]
      : [];
  }
  const keys = keyShortcuts
    .trim()
    .split(/\s+/)
    .map((shortcut) => shortcut.split("+").at(-1) || "+");
  const character = keys.find((key) => CHARACTER_KEY_NAMES.has(key));
  if (character !== undefined) {
    return [
      `${where} has aria-keyshortcuts="${keyShortcuts}", which names the character "${character}", not a key${expected ? `; expected "${expected}"` : ""} (guide §5.6)`,
    ];
  }
  if (keys.some((key) => KEY_CODE_NAME.test(key))) {
    return [
      `${where} has aria-keyshortcuts="${keyShortcuts}", a KeyboardEvent code; name the key as WAI-ARIA does (guide §5.6)`,
    ];
  }
  if (expected !== undefined && keyShortcuts !== expected) {
    return [
      `${where} has aria-keyshortcuts="${keyShortcuts}" for the chip "${chip}", expected "${expected}": the keys of the US, then the German layout (guide §5.6)`,
    ];
  }
  return [];
}
