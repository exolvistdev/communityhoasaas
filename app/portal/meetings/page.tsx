import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { meetingIsPast } from "@/lib/meeting";
import { RsvpButtons } from "./RsvpButtons";

export const metadata = { title: "Board meetings · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function PortalMeetingsPage() {
  const { user, org } = await getHomeownerContext();

  const meetings = await prisma.boardMeeting.findMany({
    where: { orgId: org.id, status: { not: "CANCELLED" } },
    include: {
      minutesDocument: { select: { id: true } },
      rsvps: { where: { userId: user.id }, select: { response: true } },
    },
    orderBy: { scheduledAt: "desc" },
  });

  const upcoming = meetings
    .filter((m) => m.status === "SCHEDULED" && !meetingIsPast(m))
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const past = meetings.filter(
    (m) => m.status === "HELD" || meetingIsPast(m)
  );

  return (
    <div className="space-y-5">
      <Link href="/portal" className="text-sm text-fg-muted hover:text-fg">
        ← Back
      </Link>
      <h1 className="text-lg font-semibold text-fg">Board meetings</h1>

      {meetings.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted">
          No meetings scheduled.
        </p>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-fg">Upcoming</h2>
          {upcoming.map((m) => (
            <div
              key={m.id}
              className="space-y-3 rounded-lg border border-border bg-surface p-4"
            >
              <div>
                <div className="font-medium text-fg">{m.title}</div>
                <div className="text-xs text-fg-muted">
                  {fmt(m.scheduledAt)}
                  {m.location ? ` · ${m.location}` : ""}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                  Agenda
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-fg">
                  {m.agenda}
                </p>
              </div>
              <RsvpButtons
                meetingId={m.id}
                current={m.rsvps[0]?.response ?? null}
              />
            </div>
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">Past</h2>
          <ul className="space-y-2">
            {past.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 text-sm"
              >
                <div>
                  <div className="font-medium text-fg">{m.title}</div>
                  <div className="text-xs text-fg-subtle">{fmt(m.scheduledAt)}</div>
                </div>
                {m.minutesDocument ? (
                  <a
                    href={`/documents/${m.minutesDocument.id}`}
                    className="text-brand-accent hover:underline"
                  >
                    View minutes
                  </a>
                ) : (
                  <span className="text-xs text-fg-subtle">Minutes pending</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
