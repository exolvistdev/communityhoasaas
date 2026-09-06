import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { buildCloseoutPreview } from "@/lib/closeout";
import { peso } from "@/lib/format";
import { CloseoutWizard } from "./CloseoutWizard";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Close out unit · HOA SaaS" };

export default async function CloseoutPage({
  params,
}: {
  params: { id: string };
}) {
  const { org } = await requirePermission("property:write");
  const preview = await buildCloseoutPreview(params.id, org.id);
  if (!preview) notFound();

  const backLink = (
    <Link
      href={`/properties/${params.id}`}
      className="text-sm text-fg-muted hover:text-fg"
    >
      ← {preview.property.unitNumber}
    </Link>
  );

  if (preview.property.archivedAt) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        {backLink}
        <div className="rounded-lg border border-border bg-surface p-6 text-sm text-fg-muted">
          This unit is archived — it has already been closed out.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader
        title={`Close out ${preview.property.unitNumber}`}
        description="Hand the unit to a new owner, or mark it vacated. Settle the balance, swap the residents, and revoke logins that are no longer needed."
        backLink={{
          href: `/properties/${params.id}`,
          label: preview.property.unitNumber,
        }}
      />

      <div className="rounded-lg border border-border bg-surface p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-fg-muted">Current balance</span>
          <span
            className={`font-semibold ${
              preview.outstanding > 0.005 ? "text-warning-fg" : "text-success-fg"
            }`}
          >
            {peso(preview.outstanding)}
          </span>
        </div>
        <Link
          href={`/statements/${preview.property.id}`}
          className="mt-1 inline-block text-xs text-fg-muted underline underline-offset-2 hover:text-fg"
        >
          View the final statement
        </Link>

        {preview.people.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-border pt-3">
            {preview.people.map((p, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="text-fg">
                  {p.fullName}
                  <span className="ml-1.5 text-fg-subtle">
                    {p.role.toLowerCase()}
                    {p.isPrimary ? " · primary" : ""}
                  </span>
                </span>
                {p.loginEmail ? (
                  <span className="text-fg-subtle">
                    {p.keepsAccess
                      ? "login kept (owns another unit)"
                      : "login will be revoked"}
                  </span>
                ) : (
                  <span className="text-fg-subtle">no login</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <CloseoutWizard
        propertyId={preview.property.id}
        unitNumber={preview.property.unitNumber}
        outstanding={preview.outstanding}
      />
    </div>
  );
}
