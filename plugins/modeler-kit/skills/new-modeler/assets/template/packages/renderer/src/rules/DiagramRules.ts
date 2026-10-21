import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';
import type { Element } from 'diagram-js/lib/model/Types';
import { isNodeShape } from '../model/di-types.js';

/** Nodes live directly on the root, move freely and keep their size. */
export default class DiagramRules extends RuleProvider {
  override init(): void {
    const onRoot = (context: { target?: Element }) =>
      !!context.target && !isNodeShape(context.target) && !context.target.parent;
    this.addRule('shape.create', onRoot);
    this.addRule('elements.create', onRoot);
    this.addRule(['shape.move', 'elements.move'], () => true);
    this.addRule('shape.resize', () => false);
    this.addRule('connection.create', () => false);
  }
}
