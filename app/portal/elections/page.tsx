import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { electionIsOpen } from "@/lib/election";
import { controllableUnits } from "@/lib/votes";
import { orgUnitStanding } from "@/lib/good-standing";
import { CandidateChecklist } from "./CandidateChecklist";

export const metadata = { title: "Elections · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function PortalElectionsPage() {
  const { user, org } = await getHomeownerContext();

  const [elections, control, standing] = await Promise.all([
    prisma.election.findMany({
      where: { orgId: org.id, status: { in: ["OPEN", "CLOSED"] } },
      include: {
        resultDocument: { select: { id: true } },
        candidates: {
          where: { withdrawn: false },
          orderBy: { name: "asc" },
          select: { id: true, name: true, bio: true },
        },
        ballots: {
          where: {
            OR: [
              { property: { homeowners: { some: { userId: user.id } } } },
              { viaProxy: { holderUserId: user.id } },
            ],
          },
          select: {
            propertyId: true,
            abstain: true,
            votes: { select: { candidateId: true } },
          },
        },
      },
      orderBy: { opensAt: "desc" },
    }),
    controllableUnits(user.id, org.id),
    orgUnitStanding(org.id),
  ]);

  const withStanding = <T extends { id: string }>(u: T) => ({
    ...u,
    monthsBehind: standing.get(u.id)?.monthsBehind ?? 0,
    suspended: !(standing.get(u.id)?.inGoodStanding ?? true),
  });
  const units = [
    ...control.own.map((p) =>
      withStanding({ id: p.id, unitNumber: p.unitNumber, label: "your unit" })
    ),
    ...control.proxy.map((p) =>
      withStanding({
        id: p.propertyId,
        unitNumber: p.unitNumber,
        label: `proxy${p.note ? ` — ${p.note}` : ""}`,
      })
    ),
  ];

  const open = elections.filter((e) => electionIsOpen(e));
  const past = elections.filter((e) => !electionIsOpen(e));

  return (
    <div className="space-y-5">
      <Link href="/portal" className="text-sm text-fg-muted hover:text-fg">
        ← Back
      </Link>
      <h1 className="text-lg font-semibold text-fg">Board elections</h1>

      {elections.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted">
          No elections right now.
        </p>
      )}

      {open.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-fg">Open now</h2>
          {open.map((e) => {
            const myBallot = (propertyId: string) =>
              e.ballots.find((b) => b.propertyId === propertyId);
            return (
              <div
                key={e.id}
                className="space-y-3 rounded-lg border border-border bg-surface p-4"
              >
                <div>
                  <div className="font-medium text-fg">{e.title}</div>
                  <div className="text-xs text-fg-muted">
                    Closes {fmt(e.closesAt)} · pick up to {e.seats} of{" "}
                    {e.candidates.length} candidates
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-fg">
                  {e.description}
                </p>
                {units.length === 0 ? (
                  <p className="text-sm text-fg-subtle">
                    Your account isn&apos;t linked to a unit, so you can&apos;t vote.
                  </p>
                ) : (
                  units.map((u) =>
                    u.suspended ? (
                      <div
                        key={u.id}
                        className="border-t border-border pt-3 text-sm"
                      >
                        <div className="mb-1 text-xs font-medium text-fg-muted">
                          {u.unitNumber} — {u.label}
                        </div>
                        <p className="text-fg-subtle">
                          This unit is {u.monthsBehind} month
                          {u.monthsBehind === 1 ? "" : "s"} behind on dues — settle
                          the balance to vote.
                        </p>
                      </div>
                    ) : (
                      <CandidateChecklist
                        key={u.id}
                        electionId={e.id}
                        propertyId={u.id}
                        unitLabel={`${u.unitNumber} — ${u.label}`}
                        seats={e.seats}
                        candidates={e.candidates}
                        current={
                          myBallot(u.id)?.votes.map((v) => v.candidateId) ?? []
                        }
                        abstained={myBallot(u.id)?.abstain ?? false}
                      />
                    )
                  )
                )}
              </div>
            );
          })}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">Closed</h2>
          <ul className="space-y-2">
            {past.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 text-sm"
              >
                <div>
                  <div className="font-medium text-fg">{e.title}</div>
                  <div className="text-xs text-fg-subtle">
                    Closed {fmt(e.closesAt)}
                  </div>
                </div>
                {e.resultDocument ? (
                  <a
                    href={`/documents/${e.resultDocument.id}`}
                    className="text-brand-accent hover:underline"
                  >
                    View result
                  </a>
                ) : (
                  <Link
                    href="/portal/board"
                    className="text-brand-accent hover:underline"
                  >
                    See the board
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
