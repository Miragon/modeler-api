import type { ModuleDeclaration } from 'didi';
import ElementFactory from './ElementFactory.js';
import NodeFactory from './NodeFactory.js';

export const modelModule: ModuleDeclaration = {
  elementFactory: ['type', ElementFactory],
  nodeFactory: ['type', NodeFactory],
};

export { default as NodeFactory } from './NodeFactory.js';
export { isNodeShape, type NodeShape } from './di-types.js';
