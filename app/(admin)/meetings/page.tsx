import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { MEETING_STATUS_BADGE, rsvpTally, meetingIsPast } from "@/lib/meeting";
import { PageHeader } from "@/components/PageHeader";
import { MeetingsManager } from "./MeetingsManager";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";

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

  const columns: ResponsiveColumn<(typeof meetings)[number]>[] = [
    {
      key: "title",
      header: "Title",
      card: "title",
      cell: (m) => (
        <>
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
        </>
      ),
    },
    {
      key: "rsvp",
      header: "RSVPs",
      className: "text-xs text-fg-muted",
      cell: (m) => {
        const t = rsvpTally(m.rsvps);
        return t.total > 0 ? `${t.yes} going · ${t.maybe} maybe` : "No RSVPs";
      },
    },
    {
      key: "status",
      header: "Status",
      card: "status",
      cell: (m) => {
        const badge = MEETING_STATUS_BADGE[m.status];
        return (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        );
      },
    },
    {
      key: "minutes",
      header: "Minutes",
      align: "right",
      className: "text-xs",
      cell: (m) =>
        m.minutesDocument ? (
          <span className="text-success-fg">Minutes published</span>
        ) : m.status !== "CANCELLED" ? (
          <span className="text-fg-subtle">No minutes yet</span>
        ) : null,
    },
  ];

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      <ResponsiveTable columns={columns} rows={meetings} rowKey={(m) => m.id} hideHeader />
    </section>
  );
}
