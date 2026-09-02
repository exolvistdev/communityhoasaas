import { Wordmark } from "@/components/Wordmark";
import { Card } from "@/components/ui/card";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand bg-gradient-to-br from-brand-hi to-brand p-10 text-brand-fg lg:flex lg:flex-col lg:justify-between">
        <Wordmark
          label="HOA Manager"
          className="[&_span]:!text-brand-fg [&_svg]:text-brand"
        />
        <div className="max-w-sm">
          <p className="text-2xl font-semibold leading-snug">
            Billing, records and gate security for your subdivision — in one place.
          </p>
          <p className="mt-3 text-sm text-brand-fg/70">
            Accurate dues, an auditable ledger, and a portal your homeowners
            actually use.
          </p>
        </div>
        <div className="text-xs text-brand-fg/50">
          Multi-tenant HOA management · Philippine market
        </div>
      </div>

      <div className="flex flex-col items-center justify-center bg-bg px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <Wordmark label="HOA Manager" />
          </div>
          <h1 className="text-xl font-semibold text-fg">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>
          )}
          <Card className="mt-5 p-6">{children}</Card>
          {footer && (
            <p className="mt-5 text-center text-sm text-fg-muted">{footer}</p>
          )}
        </div>
      </div>
    </div>
  );
}
