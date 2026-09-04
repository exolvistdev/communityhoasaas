import type { OrgStatus } from "@prisma/client";
import { trialDaysLeft, isOrgLocked } from "@/lib/trial";

export function OrgStatusBadge({
  org,
}: {
  org: { status: OrgStatus; trialEndsAt: Date | null };
}) {
  if (org.status === "ACTIVE")
    return (
      <span className="rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-fg">
        Active
      </span>
    );

  if (isOrgLocked(org))
    return (
      <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger-fg">
        Trial expired
      </span>
    );

  const daysLeft = trialDaysLeft(org);
  return (
    <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-fg">
      Trial · {daysLeft} day{daysLeft === 1 ? "" : "s"} left
    </span>
  );
}
