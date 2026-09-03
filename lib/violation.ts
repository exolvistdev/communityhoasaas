import type { ViolationCategory, ViolationStatus } from "@prisma/client";

// Pure violation helpers — safe to import from client components.

export const VIOLATION_CATEGORIES: { value: ViolationCategory; label: string }[] = [
  { value: "NOISE", label: "Noise" },
  { value: "PARKING", label: "Parking" },
  { value: "PET", label: "Pets" },
  { value: "WASTE", label: "Garbage / waste" },
  { value: "LANDSCAPING", label: "Landscaping / upkeep" },
  { value: "ARCHITECTURAL", label: "Unapproved construction" },
  { value: "NUISANCE", label: "Nuisance" },
  { value: "SAFETY", label: "Safety hazard" },
  { value: "OTHER", label: "Other" },
];

export const VIOLATION_CATEGORY_LABEL = Object.fromEntries(
  VIOLATION_CATEGORIES.map((c) => [c.value, c.label])
) as Record<ViolationCategory, string>;

export function isViolationCategory(v: unknown): v is ViolationCategory {
  return typeof v === "string" && v in VIOLATION_CATEGORY_LABEL;
}

export const VIOLATION_STATUS_BADGE: Record<
  ViolationStatus,
  { label: string; className: string }
> = {
  OPEN: {
    label: "Open",
    className: "bg-warning-subtle text-warning-fg ring-1 ring-inset ring-warning/25",
  },
  APPEALED: {
    label: "Appealed",
    className: "bg-brand-subtle text-brand-accent ring-1 ring-inset ring-brand/25",
  },
  CURED: {
    label: "Cured",
    className: "bg-success-subtle text-success-fg ring-1 ring-inset ring-success/25",
  },
  DISMISSED: {
    label: "Dismissed",
    className: "bg-surface-2 text-fg-muted ring-1 ring-inset ring-border",
  },
};

/** The next sequential notice number for a violation's fine notices. */
export function nextNoticeNumber(notices: { noticeNumber: number }[]): number {
  return notices.reduce((max, n) => Math.max(max, n.noticeNumber), 0) + 1;
}

const TRANSITIONS: Record<ViolationStatus, ViolationStatus[]> = {
  OPEN: ["CURED", "DISMISSED", "APPEALED"],
  APPEALED: ["OPEN", "CURED", "DISMISSED"],
  CURED: ["OPEN"],
  DISMISSED: ["OPEN"],
};

/** Whether staff may move a violation from one status to another. */
export function canTransitionViolation(
  from: ViolationStatus,
  to: ViolationStatus
): boolean {
  return from === to ? false : (TRANSITIONS[from]?.includes(to) ?? false);
}

/** Statuses a violation counts as "resolved" (no longer needs attention). */
export const RESOLVED_STATUSES: ViolationStatus[] = ["CURED", "DISMISSED"];

// Kept in sync with lib/violation-photos.ts (server-only — not imported client-side).
export const VIOLATION_PHOTO_ACCEPT = "image/png,image/jpeg,image/webp";
export const VIOLATION_PHOTO_MAX = 8;
