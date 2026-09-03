import type { MeetingStatus, RsvpResponse } from "@prisma/client";

// Pure board-meeting helpers — safe to import from client components.

export const MEETING_STATUS_BADGE: Record<
  MeetingStatus,
  { label: string; className: string }
> = {
  SCHEDULED: {
    label: "Scheduled",
    className: "bg-brand-subtle text-brand-accent ring-1 ring-inset ring-brand/25",
  },
  HELD: {
    label: "Held",
    className: "bg-success-subtle text-success-fg ring-1 ring-inset ring-success/25",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-surface-2 text-fg-muted ring-1 ring-inset ring-border",
  },
};

export const RSVP_OPTIONS: { value: RsvpResponse; label: string }[] = [
  { value: "YES", label: "Going" },
  { value: "MAYBE", label: "Maybe" },
  { value: "NO", label: "Can't make it" },
];

export const RSVP_LABEL: Record<RsvpResponse, string> = {
  YES: "Going",
  MAYBE: "Maybe",
  NO: "Not going",
};

export type RsvpTally = { yes: number; no: number; maybe: number; total: number };

/** Count RSVP responses. */
export function rsvpTally(rsvps: { response: RsvpResponse }[]): RsvpTally {
  const t: RsvpTally = { yes: 0, no: 0, maybe: 0, total: rsvps.length };
  for (const r of rsvps) {
    if (r.response === "YES") t.yes++;
    else if (r.response === "NO") t.no++;
    else t.maybe++;
  }
  return t;
}

/** Whether a meeting's scheduled time is in the past. */
export function meetingIsPast(
  meeting: { scheduledAt: Date },
  now: Date = new Date()
): boolean {
  return meeting.scheduledAt.getTime() < now.getTime();
}
