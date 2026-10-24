import { ariaKeyShortcutsFromLabel } from "../core/index.js";

// The characters a key types only with ⇧ on the US or the German main layout (guide §5.6).
const SHIFTED_CHARACTERS = new Set("!\"#$%&'()*+/:;<=>?_");

// Key names that are characters: no key of the US or the German layout types them without ⇧, AltGr
// or a dead key, and WAI-ARIA calls the plus key Plus.
const CHARACTER_KEY_NAMES = new Set('!"$%&()*+:>?@^_{|}~');

// KeyboardEvent.code names a key's position, not the key name WAI-ARIA asks for (guide §5.6).
const KEY_CODE_NAME =
  /^(Key[A-Z]|Digit\d|Numpad\w+|Equal|Minus|Slash|Backslash|IntlBackslash|Comma|Period|Semicolon|Quote|Backquote|BracketLeft|BracketRight)$/;

/**
 * Guide §5.6 (design system 1.21.0): `aria-keyshortcuts` names keys, not the characters they type
 * (WAI-ARIA 1.2, a MUST). A key name such as `?` or `Shift+?` names a character, `Equal` a
 * KeyboardEvent code. A chip whose character needs ⇧ on the US or the German layout names the keys
 * of both, US first, as `ariaKeyShortcutsFromLabel` derives them: `?` → `Shift+/ Shift+ß`, `/` →
 * `/ Shift+7`, the zoom-in chip `⌘+` → `Meta+= Meta+Plus`.
 */
export function keyShortcutsValueProblems(where: string, chip: string, value: string): string[] {
  const chipCharacter = /plus$/i.test(chip.trim()) ? "+" : chip.trim().slice(-1);
  const expected = SHIFTED_CHARACTERS.has(chipCharacter)
    ? ariaKeyShortcutsFromLabel(chip)
    : undefined;
  const keys = value
    .trim()
    .split(/\s+/)
    .map((shortcut) => shortcut.split("+").at(-1) || "+");
  const character = keys.find((key) => CHARACTER_KEY_NAMES.has(key));
  if (character !== undefined) {
    return [
      `${where} has aria-keyshortcuts="${value}", which names the character "${character}", not a key${expected ? `; expected "${expected}"` : ""} (guide §5.6)`,
    ];
  }
  if (keys.some((key) => KEY_CODE_NAME.test(key))) {
    return [
      `${where} has aria-keyshortcuts="${value}", a KeyboardEvent code; name the key as WAI-ARIA does (guide §5.6)`,
    ];
  }
  if (expected !== undefined && value !== expected) {
    return [
      `${where} has aria-keyshortcuts="${value}" for the chip "${chip}", expected "${expected}": the keys of the US, then the German layout (guide §5.6)`,
    ];
  }
  return [];
}
