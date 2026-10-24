/** Maps the web-app specs open through links and files. */

const context = (id: string, label: string, x: number, y: number) => ({
  id,
  label,
  subdomainType: "supporting",
  position: { x, y },
  size: { width: 200, height: 110 },
});

/**
 * Three findings of the semantic rules, each on a drawn relationship: a customer-supplier
 * relationship whose downstream conforms and whose upstream offers an Open Host Service (two
 * errors), and one with an ACL (a warning).
 */
export const MAP_WITH_FINDINGS = {
  version: 1,
  title: "Findings",
  contexts: [
    context("ordering", "Ordering", 100, 100),
    context("billing", "Billing", 500, 100),
    context("shipping", "Shipping", 500, 400),
  ],
  relationships: [
    {
      id: "rel_order_bill",
      from: "ordering",
      to: "billing",
      pattern: "customer-supplier",
      upstreamRoles: ["OHS"],
      downstreamRoles: ["CF"],
    },
    {
      id: "rel_bill_ship",
      from: "billing",
      to: "shipping",
      pattern: "customer-supplier",
      downstreamRoles: ["ACL"],
    },
  ],
};

/**
 * Two contexts in a partnership, small enough to fit at 100 % in the shell kit's wide size
 * (1280 × 900), for the labelEditor case of its conformance suites; every other case opens the
 * example. The example fits at 68 % there: modeler-shell 0.4.0's labelEditor case zooms in one
 * step from the fitted view and then presses Cmd/Ctrl+0, and from any fit between 64 % and 86 %
 * that step lands on 100 % already, so Cmd/Ctrl+0 cannot change the view and the case fails on its
 * own precondition. Once the kit takes the view off 100 % before that step, the case can open the
 * example too.
 */
export const COMPACT_MAP = {
  version: 1,
  title: "Compact",
  contexts: [context("ordering", "Ordering", 100, 100), context("billing", "Billing", 460, 100)],
  relationships: [
    { id: "rel_order_bill", from: "ordering", to: "billing", pattern: "partnership" },
  ],
};

/** A Context Mapper file with a role the reader does not know and skips. */
export const CML_WITH_UNKNOWN_ROLE = `ContextMap Shop {
  contains Ordering, Billing
  Ordering [U,BAD]->[D,ACL] Billing
}
`;
