#!/usr/bin/env node
// Copies the new-modeler template into an empty directory and fills in its placeholders.
//
//   node new-modeler.mjs <target> --notation capability-map --name "Capability Map" \
//     --ext capmap --repo capability-map-modeler
//
// Plain Node (no dependencies), so it runs from the installed plugin as it is.
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TEMPLATE_DIR = fileURLToPath(new URL("../assets/template/", import.meta.url));

/** Every placeholder of the template: the option that fills it and the form it must have. */
export const PLACEHOLDERS = {
  __NOTATION__: {
    option: "notation",
    pattern: /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
    hint: "kebab-case slug, e.g. capability-map",
  },
  __DISPLAY_NAME__: {
    option: "name",
    pattern: /^[A-Z][A-Za-z0-9]*( [A-Za-z0-9]+)*$/,
    hint: 'words in title case, e.g. "Capability Map"',
  },
  __EXT__: { option: "ext", pattern: /^[a-z][a-z0-9]*$/, hint: "lower-case, no dot, e.g. capmap" },
  __REPO__: {
    option: "repo",
    pattern: /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
    hint: "repository name under github.com/Miragon, e.g. capability-map-modeler",
  },
};

const LEFTOVER = /__[A-Z][A-Z_]*__/;

function filesUnder(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function fill(text, values) {
  let filled = text;
  for (const [placeholder, { option }] of Object.entries(PLACEHOLDERS)) {
    filled = filled.split(placeholder).join(values[option]);
  }
  return filled;
}

/** The template's files with every placeholder filled, as `{ path, content }` (paths relative). */
export function instantiate(values, templateDir = TEMPLATE_DIR) {
  for (const [placeholder, { option, pattern, hint }] of Object.entries(PLACEHOLDERS)) {
    const value = values[option];
    if (typeof value !== "string" || !pattern.test(value)) {
      throw new Error(
        `--${option} (${placeholder}) must be a ${hint}; got ${JSON.stringify(value)}`,
      );
    }
  }
  return filesUnder(templateDir).map((file) => {
    const path = fill(relative(templateDir, file), values);
    const content = fill(readFileSync(file, "utf8"), values);
    const leftover = LEFTOVER.exec(path) ?? LEFTOVER.exec(content);
    if (leftover) throw new Error(`${path}: unknown placeholder ${leftover[0]}`);
    return { path, content };
  });
}

function parseArguments(argv) {
  const values = {};
  const positional = [];
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument.startsWith("--")) values[argument.slice(2)] = argv[++index];
    else positional.push(argument);
  }
  return { target: positional[0], values };
}

function main() {
  const { target, values } = parseArguments(process.argv.slice(2));
  if (!target) {
    console.error(
      'usage: new-modeler.mjs <target> --notation <slug> --name "<Name>" --ext <ext> --repo <repo>',
    );
    process.exit(2);
  }
  const targetDir = resolve(target);
  let existing = [];
  try {
    existing = readdirSync(targetDir).filter((name) => name !== ".git");
  } catch {
    // a new directory
  }
  if (existing.length > 0) {
    console.error(`${targetDir} is not empty; the template only starts new repositories.`);
    process.exit(1);
  }
  const files = instantiate(values);
  for (const { path, content } of files) {
    const file = join(targetDir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  console.log(
    `Wrote ${files.length} files to ${targetDir}. Next: see "After copying" in SKILL.md.`,
  );
}

// Run as a script, not when imported (a path through a symlinked directory counts as the same file).
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
