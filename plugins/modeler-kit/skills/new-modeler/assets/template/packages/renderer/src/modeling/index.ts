import type { ModuleDeclaration } from 'didi';
import DomainModeling from './DomainModeling.js';

export const domainModelingModule: ModuleDeclaration = {
  __init__: ['domainModeling'],
  domainModeling: ['type', DomainModeling],
};

export { default as DomainModeling } from './DomainModeling.js';
