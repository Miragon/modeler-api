/**
 * Application shell. A full-bleed diagram-js canvas (the framework-agnostic
 * "plain" renderer, with its own top-centre palette, element-bound context pad
 * and bottom-left legend) and Excalidraw-style floating chrome layered on top:
 * menu (top-left), Share (top-right) and the legal notice (bottom-right).
 */

import { ModelerProvider } from "@/state/modeler";
import { DiagramCanvas } from "@/ui/DiagramCanvas";
import { EmptyState } from "@/ui/EmptyState";
import { Menu } from "@/ui/Menu";
import { ShareButton } from "@/ui/ShareButton";
import { LegalNotice } from "@/ui/LegalNotice";
import { HelpDialog } from "@/ui/HelpDialog";
import { HoverTooltip } from "@/ui/HoverTooltip";
import { Toaster } from "@/ui/Toaster";

export default function App() {
  return (
    <ModelerProvider>
      <div className="tt-app">
        <DiagramCanvas />
        <EmptyState />
        <div className="tt-chrome tt-chrome--left">
          <Menu />
        </div>
        <div className="tt-chrome tt-chrome--right">
          <ShareButton />
        </div>
        <LegalNotice />
        <HelpDialog />
        <HoverTooltip />
        <Toaster />
      </div>
    </ModelerProvider>
  );
}
