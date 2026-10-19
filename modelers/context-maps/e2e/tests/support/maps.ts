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

/** A Context Mapper file with a role the reader does not know and skips. */
export const CML_WITH_UNKNOWN_ROLE = `ContextMap Shop {
  contains Ordering, Billing
  Ordering [U,BAD]->[D,ACL] Billing
}
`;
