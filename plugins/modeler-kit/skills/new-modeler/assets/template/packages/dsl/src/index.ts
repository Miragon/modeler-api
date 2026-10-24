import type { DiagramDocument, DiagramNode } from '@miragon/__NOTATION__-schema-model';

/*
 * The text format, one statement per line (replace it with your notation's grammar):
 *
 *   title Order fulfilment
 *   node order "Place order" [120, 80]
 *   # a comment, or any line this version does not understand, is kept as it is
 *
 * The parser is lenient: a line it cannot read stays in `passthrough` and comes back on export,
 * so a half-typed line never loses the rest of the document.
 */

export interface Diagnostic {
  /** 1-based line number. */
  line: number;
  message: string;
}

export interface ParseResult {
  document: DiagramDocument;
  diagnostics: Diagnostic[];
}

const TITLE = /^title\s+(\S.*)$/;
const NODE =
  /^node\s+([A-Za-z_][A-Za-z0-9_-]*)\s+"((?:[^"\\]|\\.)*)"\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]$/;

export function parseText(text: string): ParseResult {
  const nodes: DiagramNode[] = [];
  const passthrough: string[] = [];
  const diagnostics: Diagnostic[] = [];
  let title: string | undefined;

  text.split(/\r\n|\n|\r/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === '') return;
    const titleMatch = TITLE.exec(line);
    if (titleMatch && title === undefined) {
      title = titleMatch[1]!.trim();
      return;
    }
    const nodeMatch = NODE.exec(line);
    if (nodeMatch) {
      const [, id, label, x, y] = nodeMatch as unknown as [string, string, string, string, string];
      nodes.push({ id, label: unescapeLabel(label), x: Number(x), y: Number(y) });
      return;
    }
    passthrough.push(line);
    if (!line.startsWith('#')) {
      diagnostics.push({
        line: index + 1,
        message: line.startsWith('node')
          ? 'Expected node <id> "<label>" [x, y].'
          : `Unknown statement "${line.split(/\s/)[0]}", kept as it is.`,
      });
    }
  });

  return {
    document: { ...(title === undefined ? {} : { title }), nodes, passthrough },
    diagnostics,
  };
}

/**
 * The canonical text: the title, the nodes in document order, then the passthrough lines. A
 * fixpoint of its own parser (law L2), so opening a canonical file never rewrites it.
 */
export function serializeText(document: DiagramDocument): string {
  const lines: string[] = [];
  if (document.title !== undefined && document.title.trim() !== '') {
    lines.push(`title ${document.title.trim()}`);
  }
  for (const node of document.nodes) {
    lines.push(
      `node ${node.id} "${escapeLabel(node.label)}" [${Math.round(node.x)}, ${Math.round(node.y)}]`,
    );
  }
  lines.push(...document.passthrough);
  return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}

function escapeLabel(label: string): string {
  return label.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

function unescapeLabel(label: string): string {
  return label.replace(/\\(.)/g, '$1');
}
