/**
 * Subtle legal-notice footer with the Miragon wordmark. The operator
 * (Miragon GmbH) hosts the demo, so the deployed app links out to the existing
 * legal pages on miragon.io — no legal text is duplicated/maintained here.
 */

// Official CI wordmark (green — the brand default on light ground), vendored from the
// miragon-brand:corporate-design skill. Never redraw or recolour; 96px is the CI minimum web width.
import miragonWordmark from "../assets/miragon-logo-gruen.svg";

export function LegalNotice() {
  return (
    <footer className="tt-legal" aria-label="Legal">
      <a
        className="tt-legal__brand"
        href="https://miragon.io"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Miragon"
      >
        <img src={miragonWordmark} alt="Miragon" width={96} height={15} />
      </a>
      <span aria-hidden="true">·</span>
      <a href="https://miragon.io/impressum/" target="_blank" rel="noopener noreferrer">
        Impressum
      </a>
      <span aria-hidden="true">·</span>
      <a href="https://miragon.io/datenschutz/" target="_blank" rel="noopener noreferrer">
        Datenschutz
      </a>
    </footer>
  );
}
