import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { voteIsOpen, THRESHOLD_LABEL } from "@/lib/vote";
import { controllableUnits } from "@/lib/votes";
import { BallotForm } from "./BallotForm";
import { ProxyManager } from "./ProxyManager";

export const metadata = { title: "Votes · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function PortalVotesPage() {
  const { user, org } = await getHomeownerContext();

  const [votes, control, proxies] = await Promise.all([
    prisma.boardVote.findMany({
      where: { orgId: org.id, status: { in: ["OPEN", "CLOSED"] } },
      include: {
        resultDocument: { select: { id: true } },
        ballots: {
          where: {
            OR: [
              { property: { homeowners: { some: { userId: user.id } } } },
              { viaProxy: { holderUserId: user.id } },
            ],
          },
          select: { propertyId: true, choice: true },
        },
      },
      orderBy: { opensAt: "desc" },
    }),
    controllableUnits(user.id, org.id),
    prisma.voteProxy.findMany({
      where: {
        orgId: org.id,
        revokedAt: null,
        grantorProperty: { homeowners: { some: { userId: user.id } } },
      },
      include: {
        grantorProperty: { select: { unitNumber: true } },
        holderUser: { select: { fullName: true } },
      },
    }),
  ]);

  const units = [
    ...control.own.map((p) => ({ ...p, kind: "own" as const, label: "your unit" })),
    ...control.proxy.map((p) => ({
      id: p.propertyId,
      unitNumber: p.unitNumber,
      kind: "proxy" as const,
      label: `proxy${p.note ? ` — ${p.note}` : ""}`,
    })),
  ];

  const open = votes.filter((v) => voteIsOpen(v));
  const past = votes.filter((v) => !voteIsOpen(v));

  return (
    <div className="space-y-5">
      <Link href="/portal" className="text-sm text-fg-muted hover:text-fg">
        ← Back
      </Link>
      <h1 className="text-lg font-semibold text-fg">Votes</h1>

      {votes.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted">
          No votes right now.
        </p>
      )}

      {open.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-fg">Open now</h2>
          {open.map((v) => (
            <div
              key={v.id}
              className="space-y-3 rounded-lg border border-border bg-surface p-4"
            >
              <div>
                <div className="font-medium text-fg">{v.title}</div>
                <div className="text-xs text-fg-muted">
                  Closes {fmt(v.closesAt)} · {THRESHOLD_LABEL[v.threshold]}
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-fg">{v.description}</p>
              {units.length === 0 ? (
                <p className="text-sm text-fg-subtle">
                  Your account isn&apos;t linked to a unit, so you can&apos;t vote.
                </p>
              ) : (
                units.map((u) => (
                  <BallotForm
                    key={u.id}
                    voteId={v.id}
                    propertyId={u.id}
                    unitLabel={`${u.unitNumber} — ${u.label}`}
                    current={
                      v.ballots.find((b) => b.propertyId === u.id)?.choice ?? null
                    }
                  />
                ))
              )}
            </div>
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">Closed</h2>
          <ul className="space-y-2">
            {past.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 text-sm"
              >
                <div>
                  <div className="font-medium text-fg">{v.title}</div>
                  <div className="text-xs text-fg-subtle">
                    Closed {fmt(v.closesAt)}
                  </div>
                </div>
                {v.resultDocument ? (
                  <a
                    href={`/documents/${v.resultDocument.id}`}
                    className="text-brand-accent hover:underline"
                  >
                    View result
                  </a>
                ) : (
                  <span className="text-xs text-fg-subtle">Result pending</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {control.own.length > 0 && (
        <ProxyManager
          units={control.own.map((p) => ({ id: p.id, unitNumber: p.unitNumber }))}
          proxies={proxies.map((p) => ({
            id: p.id,
            unitNumber: p.grantorProperty.unitNumber,
            holderName: p.holderUser.fullName,
          }))}
        />
      )}
    </div>
  );
}
