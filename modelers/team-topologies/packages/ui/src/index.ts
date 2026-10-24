// Bundled with the components, so a host that renders a panel can't end up without its styles.
import "./styles/ui.css";

export { InspectorSlotContent } from "./inspector/Inspector";
export type { InspectorSlot, InspectorSlotContentProps } from "./inspector/Inspector";
export { mountInspector } from "./inspector/mountInspector";
export type { MountedInspector } from "./inspector/mountInspector";
export { makeRoomForLegend } from "./legend/makeRoomForLegend";
