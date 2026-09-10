/**
 * The copyright + build-credit + PH-law line shared by the marketing footer and
 * the standalone /privacy · /terms pages. One source of truth so the two can't
 * drift. Each caller passes its own size / colour / spacing via `className`.
 */
export function SiteLegalLine({ className }: { className?: string }) {
  return (
    <p className={className}>
      © {new Date().getFullYear()} HOA Manager
      <span className="mx-1.5">·</span>hoasaas.ph
      <span className="mx-1.5">·</span>All rights reserved.
      <span className="mx-1.5">·</span>Designed and built by{" "}
      <span className="font-medium text-fg-muted">Exolvist</span>
      <span className="mx-1.5">·</span>Built for Philippine HOA law: RA 9904
      (Magna Carta for Homeowners) &amp; RA 10173 (Data Privacy Act of 2012)
      compliant.
    </p>
  );
}
