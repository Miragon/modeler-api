/**
 * @miragon/context-maps-cml — bridges Context Mapper's CML text format and the
 * Context Maps model. Import (`parseCml`) covers the strategic context-map
 * subset; export (`serializeCml`) produces CML for interop with the wider
 * strategic-DDD tooling. DOM-free.
 */

export { parseCml } from "./parser";
export type { CmlParseResult, CmlDiagnostic } from "./parser";
export { serializeCml } from "./serializer";
