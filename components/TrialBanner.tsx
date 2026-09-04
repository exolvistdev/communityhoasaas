import { Clock } from "lucide-react";

// TODO: replace with your real sales/support contact before go-live.
const SUPPORT_EMAIL = "hello@hoasaas.ph";

export function TrialBanner({ daysLeft, orgName }: { daysLeft: number; orgName: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-warning-subtle px-4 py-1.5 text-xs font-medium text-warning-fg">
      <span className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        {daysLeft <= 0
          ? "Your free trial ends today"
          : `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}{" "}
        — contact us to keep using HOA Manager.
      </span>
      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
          `Continue our HOA Manager trial — ${orgName}`
        )}`}
        className="rounded-md bg-warning/15 px-2 py-0.5 hover:bg-warning/25"
      >
        Contact us
      </a>
    </div>
  );
}
