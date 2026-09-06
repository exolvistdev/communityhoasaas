import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { MEETING_STATUS_BADGE, rsvpTally, meetingIsPast } from "@/lib/meeting";
import { PageHeader } from "@/components/PageHeader";
import { MeetingsManager } from "./MeetingsManager";

export const metadata = { title: "Board meetings · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function MeetingsPage() {
  const { org } = await requirePermission("meeting:manage");

  const meetings = await prisma.boardMeeting.findMany({
    where: { orgId: org.id },
    include: {
      rsvps: { select: { response: true } },
      minutesDocument: { select: { id: true } },
    },
    orderBy: { scheduledAt: "desc" },
  });

  const upcoming = meetings
    .filter((m) => m.status === "SCHEDULED" && !meetingIsPast(m))
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const past = meetings.filter(
    (m) => m.status !== "SCHEDULED" || meetingIsPast(m)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Board meetings"
        description="Schedule meetings, collect RSVPs, and publish the minutes."
        action={<MeetingsManager />}
      />

      <Section title="Upcoming" meetings={upcoming} fmt={fmt} />
      <Section title="Past & cancelled" meetings={past} fmt={fmt} />
    </div>
  );
}

function Section({
  title,
  meetings,
  fmt,
}: {
  title: string;
  meetings: {
    id: string;
    title: string;
    scheduledAt: Date;
    location: string | null;
    status: "SCHEDULED" | "HELD" | "CANCELLED";
    rsvps: { response: "YES" | "NO" | "MAYBE" }[];
    minutesDocument: { id: string } | null;
  }[];
  fmt: (d: Date) => string;
}) {
  if (meetings.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <tbody>
            {meetings.map((m) => {
              const t = rsvpTally(m.rsvps);
              const badge = MEETING_STATUS_BADGE[m.status];
              return (
                <tr key={m.id} className="border-t border-border first:border-t-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/meetings/${m.id}`}
                      className="font-medium text-fg hover:underline"
                    >
                      {m.title}
                    </Link>
                    <div className="text-xs text-fg-subtle">
                      {fmt(m.scheduledAt)}
                      {m.location ? ` · ${m.location}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-muted">
                    {t.total > 0 ? `${t.yes} going · ${t.maybe} maybe` : "No RSVPs"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    {m.minutesDocument ? (
                      <span className="text-success-fg">Minutes published</span>
                    ) : m.status !== "CANCELLED" ? (
                      <span className="text-fg-subtle">No minutes yet</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
