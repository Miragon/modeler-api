// Checks what the production build must carry and the dev server never shows: the mode markup
// written into index.html by the Vite plugin (guide §13.3), the vendored Komet of the start screen
// and the licence comments of the icons the shell and the renderer copy into their sources (Lucide
// and Feather, the renderer's Material star and hand) in the bundle.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;
const html = readFileSync(join(dist, "index.html"), "utf8");
const scripts = readdirSync(join(dist, "assets"))
  .filter((name) => name.endsWith(".js"))
  .map((name) => readFileSync(join(dist, "assets", name), "utf8"));

const problems = [];
if (html.includes("<!-- miragon-mode -->")) {
  problems.push("index.html still has the mode placeholder");
}
if (!/<meta name="theme-color" content="#[0-9A-Fa-f]{6}"/.test(html)) {
  problems.push("index.html has no theme-color with a colour from the tokens");
}
if (!html.includes("prefers-contrast")) problems.push("index.html has no contrast line");
if (!html.includes('class="cd-shell-document"')) {
  problems.push('<html> lacks class="cd-shell-document"');
}
if (!existsSync(join(dist, "miragon-komet-blau.svg"))) {
  problems.push("the start screen's miragon-komet-blau.svg is missing");
}
const LICENCE_COMMENTS = {
  "the shell's Lucide icons": /@miragon\/modeler-shell icon geometry[\s\S]{0,120}@license ISC/,
  "the renderer's Lucide icons":
    /@miragon\/context-maps-renderer icon geometry[\s\S]{0,120}@license ISC/,
  "the renderer's Material star and hand":
    /@miragon\/context-maps-renderer notation glyphs[\s\S]{0,120}@license Apache-2\.0/,
};
for (const [icons, comment] of Object.entries(LICENCE_COMMENTS)) {
  if (!scripts.some((source) => comment.test(source))) {
    problems.push(`no bundle keeps the @license comment of ${icons}`);
  }
}

if (problems.length > 0) {
  console.error(`apps/webapp build check failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("apps/webapp build check: mode markup, Komet and licence comments present");
