import Link from "next/link";
import { getHomeownerContext } from "@/lib/portal";
import { boardRoster } from "@/lib/board";
import { trusteePositionLabel } from "@/lib/election";
import { termsFor } from "@/lib/terms";

export const metadata = { title: "Board · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" });

export default async function PortalBoardPage() {
  const { org } = await getHomeownerContext();
  const { current } = await boardRoster(org.id);
  const terms = termsFor(org.communityType);

  return (
    <div className="space-y-5">
      <Link href="/portal" className="text-sm text-fg-muted hover:text-fg">
        ← Back
      </Link>
      <h1 className="text-lg font-semibold text-fg">{terms.board}</h1>

      {current.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted">
          No board on record right now.
        </p>
      ) : (
        <ul className="space-y-2">
          {current.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-border bg-surface p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-fg">{t.name}</span>
                <span className="text-xs text-brand-accent">
                  {trusteePositionLabel(t.position, terms)}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-fg-subtle">
                {t.unitNumber ? `${t.unitNumber} · ` : ""}term through {fmt(t.termEnd)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
