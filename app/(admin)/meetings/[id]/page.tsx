import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { zonedParts } from "@/lib/amenity";
import {
  MEETING_STATUS_BADGE,
  RSVP_LABEL,
  rsvpTally,
} from "@/lib/meeting";
import { MeetingsManager } from "../MeetingsManager";
import { MeetingActions } from "./MeetingActions";

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const pad = (n: number) => String(n).padStart(2, "0");

export async function generateMetadata({ params }: { params: { id: string } }) {
  const m = await prisma.boardMeeting.findUnique({
    where: { id: params.id },
    select: { title: true },
  });
  return { title: m ? `${m.title} · HOA SaaS` : "Meeting · HOA SaaS" };
}

export default async function MeetingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { org } = await requirePermission("meeting:manage");

  const meeting = await prisma.boardMeeting.findFirst({
    where: { id: params.id, orgId: org.id },
    include: {
      minutesDocument: { select: { id: true, fileName: true } },
      createdBy: { select: { fullName: true } },
      rsvps: {
        include: { user: { select: { fullName: true } } },
        orderBy: { response: "asc" },
      },
    },
  });
  if (!meeting) notFound();

  const badge = MEETING_STATUS_BADGE[meeting.status];
  const tally = rsvpTally(meeting.rsvps);
  const p = zonedParts(meeting.scheduledAt);
  const dtLocal = `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(
    p.minute
  )}`;

  return (
    <div className="space-y-6">
      <Link href="/meetings" className="text-sm text-fg-muted hover:text-fg">
        ← Board meetings
      </Link>

      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
            {meeting.title}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          </h1>
          <MeetingsManager
            initial={{
              id: meeting.id,
              title: meeting.title,
              scheduledAt: dtLocal,
              location: meeting.location ?? "",
              agenda: meeting.agenda,
            }}
          />
        </div>
        <div className="mt-1 text-sm text-fg-muted">
          {fmt(meeting.scheduledAt)}
          {meeting.location ? ` · ${meeting.location}` : ""}
        </div>
        {meeting.createdBy && (
          <div className="text-xs text-fg-subtle">
            Scheduled by {meeting.createdBy.fullName}
          </div>
        )}

        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Agenda
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-fg">
            {meeting.agenda}
          </p>
        </div>
      </div>

      <MeetingActions
        meetingId={meeting.id}
        status={meeting.status}
        hasMinutes={Boolean(meeting.minutesDocument)}
        minutesFileName={meeting.minutesDocument?.fileName ?? null}
        minutesDocId={meeting.minutesDocument?.id ?? null}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">
          RSVPs{" "}
          <span className="text-fg-subtle">
            ({tally.yes} going · {tally.maybe} maybe · {tally.no} no)
          </span>
        </h2>
        {meeting.rsvps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">
            No RSVPs yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody>
                {meeting.rsvps.map((r) => (
                  <tr key={r.id} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2 text-fg">{r.user.fullName}</td>
                    <td className="px-4 py-2 text-fg-muted">
                      {RSVP_LABEL[r.response]}
                    </td>
                    <td className="px-4 py-2 text-xs text-fg-subtle">
                      {r.note ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
