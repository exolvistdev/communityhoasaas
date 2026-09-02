import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { OrgSettingsForm } from "./OrgSettingsForm";
import { PaymentSettingsForm } from "./PaymentSettingsForm";
import { LateFeeSettingsForm } from "./LateFeeSettingsForm";
import { RatePlansManager } from "./RatePlansManager";

export const metadata = { title: "Settings · HOA SaaS" };

export default async function SettingsPage() {
  const { org, user } = await requireRole("ADMIN");

  const plans = await prisma.ratePlan.findMany({
    where: { orgId: org.id },
    include: { _count: { select: { properties: true } } },
    orderBy: { name: "asc" },
  });

  const staleCounts = await Promise.all(
    plans.map((p) =>
      prisma.property.count({
        where: { ratePlanId: p.id, monthlyRate: { not: p.monthlyRate } },
      })
    )
  );

  const planData = plans.map((p, i) => ({
    id: p.id,
    name: p.name,
    monthlyRate: Number(p.monthlyRate),
    propertyCount: p._count.properties,
    staleCount: staleCounts[i],
  }));

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-lg font-semibold text-fg">Settings</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg">Organization</h2>
        <OrgSettingsForm
          org={{ name: org.name, billingDueDay: org.billingDueDay }}
        />
        <dl className="divide-y divide-border rounded-lg border border-border bg-surface text-sm">
          <Row label="Subdomain" value={`${org.subdomain}.hoasaas.ph`} />
          <Row label="Plan" value={org.plan} />
          <Row
            label="Signed in as"
            value={`${user.fullName} (${user.email}) · ${user.role}`}
          />
        </dl>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-fg">Payments</h2>
          <p className="text-xs text-fg-muted">
            Shown to homeowners on the Pay Now screen. They pay in their own
            GCash/Maya app, then submit the reference for you to confirm.
          </p>
        </div>
        <PaymentSettingsForm
          org={{
            gcashNumber: org.gcashNumber,
            gcashName: org.gcashName,
            mayaNumber: org.mayaNumber,
            mayaName: org.mayaName,
            paymentInstructions: org.paymentInstructions,
          }}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-fg">Late fees</h2>
          <p className="text-xs text-fg-muted">
            When enabled, a daily sweep adds a late-fee charge to each overdue
            dues invoice. The fee posts as its own line on the homeowner&apos;s
            statement.
          </p>
        </div>
        <LateFeeSettingsForm
          policy={{
            lateFeeEnabled: org.lateFeeEnabled,
            lateFeeType: org.lateFeeType,
            lateFeeAmount: Number(org.lateFeeAmount),
            lateFeeGraceDays: org.lateFeeGraceDays,
            lateFeeMaxOccurrences: org.lateFeeMaxOccurrences,
          }}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-fg">Rate plans</h2>
          <p className="text-xs text-fg-muted">
            Named dues tiers you assign to properties. Changing a plan&apos;s rate
            doesn&apos;t touch existing properties until you re-apply it.
          </p>
        </div>
        <RatePlansManager plans={planData} />
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-4 py-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-fg">{value}</dd>
    </div>
  );
}
