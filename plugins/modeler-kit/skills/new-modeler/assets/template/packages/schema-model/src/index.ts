import { z } from 'zod';

/** An element id: written into the text, so it survives every save and re-open. */
export const ELEMENT_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/** The size every node is drawn in, in diagram units. */
export const NODE_SIZE = { width: 160, height: 80 } as const;

/** One element of the diagram. Replace it with your notation's element kinds. */
export interface DiagramNode {
  id: string;
  label: string;
  /** The top left corner in diagram coordinates. */
  x: number;
  y: number;
}

export interface DiagramDocument {
  title?: string | undefined;
  nodes: DiagramNode[];
  /**
   * Text this version does not understand (a newer keyword, a vendor extension, a comment),
   * written back unchanged: the round trip never drops foreign content (modeler-api law L6).
   */
  passthrough: string[];
}

const nodeSchema = z.looseObject({
  id: z.string().regex(ELEMENT_ID_PATTERN),
  label: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
});

const documentSchema = z
  .looseObject({
    title: z.string().optional(),
    nodes: z.array(nodeSchema),
    passthrough: z.array(z.string()),
  })
  .superRefine((document, context) => {
    const seen = new Set<string>();
    for (const [index, node] of document.nodes.entries()) {
      if (seen.has(node.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate element id "${node.id}".`,
          path: ['nodes', index, 'id'],
        });
      }
      seen.add(node.id);
    }
  });

/** A document a canvas can show; throws with every finding when it is not one. */
export function validateDocument(input: unknown): DiagramDocument {
  const result = documentSchema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join(' '));
  }
  return result.data as DiagramDocument;
}

export function createEmptyDocument(title?: string): DiagramDocument {
  return { ...(title === undefined ? {} : { title }), nodes: [], passthrough: [] };
}
