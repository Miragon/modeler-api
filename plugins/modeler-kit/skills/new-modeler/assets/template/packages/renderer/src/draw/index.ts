import type { ModuleDeclaration } from 'didi';
import NodeRenderer from './NodeRenderer.js';

export const drawModule: ModuleDeclaration = {
  __init__: ['nodeRenderer'],
  nodeRenderer: ['type', NodeRenderer],
};

export { COLORS, FONT } from './styles.js';
