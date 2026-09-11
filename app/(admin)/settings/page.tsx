import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { PROPERTY_TYPES, TYPE_RATE_FIELD } from "@/lib/rate";
import { billablePropertyCount } from "@/lib/billing";
import { paymentQrUrl } from "@/lib/payment-qr";
import { OrgSettingsForm } from "./OrgSettingsForm";
import { CommunityTypeForm } from "./CommunityTypeForm";
import { PaymentSettingsForm } from "./PaymentSettingsForm";
import { LateFeeSettingsForm } from "./LateFeeSettingsForm";
import { ElectionSettingsForm } from "./ElectionSettingsForm";
import { TypeRatesForm } from "./TypeRatesForm";
import { RatePlansManager } from "./RatePlansManager";
import { WaterSettingsForm } from "./WaterSettingsForm";
import { WaterBulkSettingsForm } from "./WaterBulkSettingsForm";
import { WaterSourceForm } from "./WaterSourceForm";
import { VoteWeightForm } from "./VoteWeightForm";
import { waterConfig } from "@/lib/water-billing";
import { PageHeader } from "@/components/PageHeader";
import { termsFor } from "@/lib/terms";
import { monthlyEstimate } from "@/lib/pricing";
import { peso } from "@/lib/format";

export const metadata = { title: "Settings · HOA SaaS" };

export default async function SettingsPage() {
  const { org, user } = await requireRole("ADMIN");
  const terms = termsFor(org.communityType);

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

  const waterVendors =
    org.waterSource === "EXTERNAL_BULK"
      ? await prisma.vendor.findMany({
          where: { orgId: org.id, archivedAt: null },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  const planData = plans.map((p, i) => ({
    id: p.id,
    name: p.name,
    monthlyRate: Number(p.monthlyRate),
    propertyCount: p._count.properties,
    staleCount: staleCounts[i],
  }));

  // Default rate per property type + how many non-plan units are off that rate.
  const typeRows = await Promise.all(
    PROPERTY_TYPES.map(async (type) => {
      const field = TYPE_RATE_FIELD[type];
      const raw = field ? org[field] : null;
      if (raw == null) return { type, rate: null, offPlan: 0 };
      const offPlan = await prisma.property.count({
        where: {
          orgId: org.id,
          type,
          ratePlanId: null,
          archivedAt: null,
          monthlyRate: { not: raw },
        },
      });
      return { type, rate: Number(raw), offPlan };
    })
  );

  // Per-sqm: non-plan units with a floor area whose stored rate is off the
  // current ₱/sqm × area.
  let perSqmOffRate = 0;
  if (org.duesRateMode === "PER_SQM" && org.duesRatePerSqm != null) {
    const rate = Number(org.duesRatePerSqm);
    const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "properties"
       WHERE "orgId" = ${org.id}
         AND "ratePlanId" IS NULL
         AND "archivedAt" IS NULL
         AND "floorArea" IS NOT NULL
         AND "monthlyRate" <> ROUND(${rate}::numeric * "floorArea", 2)`;
    perSqmOffRate = Number(count);
  }

  // Independent counts — run together rather than one after another.
  const [unitsMissingFloorArea, billableProperties] = await Promise.all([
    org.voteWeightMode === "ONE_UNIT_ONE_VOTE"
      ? Promise.resolve(0)
      : prisma.property.count({
          where: { orgId: org.id, archivedAt: null, floorArea: null },
        }),
    billablePropertyCount(org.id),
  ]);

  // Subscription band — the live billable-property count once units exist, else
  // the approximate figure given at signup (labelled as an estimate).
  const estimatedUnits = Math.max(0, org.estimatedUnits ?? 0);
  const usingEstimate = billableProperties === 0 && estimatedUnits > 0;
  const planCount = billableProperties || estimatedUnits;
  const planEst = monthlyEstimate(planCount);
  const planValue =
    planCount === 0
      ? "No units yet"
      : `${planCount.toLocaleString("en-PH")} ${
          planCount === 1 ? terms.unit : terms.units
        }${usingEstimate ? " (estimated)" : ""} · ${peso(planEst.rate, {
          cents: false,
        })}/${terms.unit}/mo · about ${peso(planEst.total, {
          cents: false,
        })}/month`;

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Settings" />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg">Organization</h2>
        <OrgSettingsForm
          org={{
            name: org.name,
            billingDueDay: org.billingDueDay,
            privacyContactEmail: org.privacyContactEmail,
          }}
        />
        <dl className="divide-y divide-border rounded-lg border border-border bg-surface text-sm">
          <Row label="Subdomain" value={`${org.subdomain}.hoasaas.ph`} />
          <Row label="Plan" value={planValue} />
          <Row
            label="Signed in as"
            value={`${user.fullName} (${user.email}) · ${user.role}`}
          />
        </dl>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-fg">Community type</h2>
          <p className="text-xs text-fg-muted">
            Whether this is a subdivision, village, townhouse complex,
            condominium or mixed-use community. Sets the wording used across the
            app and the resident portal.
          </p>
        </div>
        <CommunityTypeForm current={org.communityType} />
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
          gcashQrUrl={org.gcashQrPath ? paymentQrUrl(org.gcashQrPath) : null}
          mayaQrUrl={org.mayaQrPath ? paymentQrUrl(org.mayaQrPath) : null}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-fg">Default dues rate</h2>
          <p className="text-xs text-fg-muted">
            How a unit&apos;s monthly dues are set when it has no rate plan and
            no custom rate — by property type, or per square metre of floor area
            (condominiums).
          </p>
        </div>
        <TypeRatesForm
          rows={typeRows}
          duesRateMode={org.duesRateMode}
          duesRatePerSqm={
            org.duesRatePerSqm != null ? Number(org.duesRatePerSqm) : null
          }
          perSqmOffRate={perSqmOffRate}
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
          <h2 className="text-sm font-semibold text-fg">
            Voting &amp; elections
          </h2>
          <p className="text-xs text-fg-muted">
            RA 9904 lets a delinquent member be denied the right to vote or run for
            the board.
          </p>
        </div>
        <ElectionSettingsForm
          electionArrearsMonths={org.electionArrearsMonths}
        />
        <div>
          <h3 className="text-sm font-semibold text-fg">Vote weighting</h3>
          <p className="text-xs text-fg-muted">
            How much each unit&apos;s ballot counts in elections and resolutions.
          </p>
        </div>
        <VoteWeightForm
          current={org.voteWeightMode}
          unitsMissingFigure={unitsMissingFloorArea}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-fg">Water</h2>
          <p className="text-xs text-fg-muted">
            How your {terms.community} gets water. This sets up (or hides)
            sub-metering and picks the billing method.
          </p>
        </div>
        <WaterSourceForm current={org.waterSource} />

        {org.waterSource === "INTERNAL" && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-fg">Water billing</h3>
              <p className="text-xs text-fg-muted">
                Meter each unit, enter monthly readings on the Water page, then
                bill the period. Charges post to Water Income and land on the
                homeowner&apos;s statement.
              </p>
            </div>
            <WaterSettingsForm config={waterConfig(org)} />
          </>
        )}

        {org.waterSource === "EXTERNAL_BULK" && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-fg">Bulk water billing</h3>
              <p className="text-xs text-fg-muted">
                The utility bills the HOA one master bill; the system splits it
                across each unit&apos;s sub-meter. The bill posts to Water
                Purchased and the resident charges to Water Income.
              </p>
            </div>
            <WaterBulkSettingsForm
              config={{
                enabled: org.waterBillingEnabled,
                vendorId: org.waterUtilityVendorId,
                lossPolicy: org.waterLossPolicy,
                adminFeeFlat:
                  org.waterAdminFeeFlat != null
                    ? Number(org.waterAdminFeeFlat)
                    : null,
              }}
              vendors={waterVendors}
            />
          </>
        )}
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
