import type { MaintenanceCategory, MaintenanceStatus } from "@prisma/client";

// Pure maintenance helpers — safe to import from client components.

export const MAINTENANCE_CATEGORIES: {
  value: MaintenanceCategory;
  label: string;
}[] = [
  { value: "PLUMBING", label: "Plumbing" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "HVAC", label: "Aircon / ventilation" },
  { value: "APPLIANCE", label: "Appliance" },
  { value: "STRUCTURAL", label: "Structural / building" },
  { value: "PEST", label: "Pest control" },
  { value: "LANDSCAPING", label: "Landscaping / grounds" },
  { value: "COMMON_AREA", label: "Common area" },
  { value: "SECURITY", label: "Security / gate" },
  { value: "OTHER", label: "Other" },
];

export const MAINTENANCE_CATEGORY_LABEL = Object.fromEntries(
  MAINTENANCE_CATEGORIES.map((c) => [c.value, c.label])
) as Record<MaintenanceCategory, string>;

export function isMaintenanceCategory(v: unknown): v is MaintenanceCategory {
  return typeof v === "string" && v in MAINTENANCE_CATEGORY_LABEL;
}

export const MAINTENANCE_STATUS_BADGE: Record<
  MaintenanceStatus,
  { label: string; className: string }
> = {
  OPEN: {
    label: "Open",
    className: "bg-warning-subtle text-warning-fg ring-1 ring-inset ring-warning/25",
  },
  ACKNOWLEDGED: {
    label: "Acknowledged",
    className: "bg-brand-subtle text-brand-accent ring-1 ring-inset ring-brand/25",
  },
  IN_PROGRESS: {
    label: "In progress",
    className: "bg-brand-subtle text-brand-accent ring-1 ring-inset ring-brand/25",
  },
  RESOLVED: {
    label: "Resolved",
    className: "bg-success-subtle text-success-fg ring-1 ring-inset ring-success/25",
  },
  CLOSED: {
    label: "Closed",
    className: "bg-surface-2 text-fg-muted ring-1 ring-inset ring-border",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-surface-2 text-fg-muted ring-1 ring-inset ring-border",
  },
};

/** Statuses that still need staff attention (drive the open-count badge). */
export const MAINTENANCE_OPEN_STATUSES: MaintenanceStatus[] = [
  "OPEN",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
];

const STAFF_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  OPEN: ["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CANCELLED"],
  ACKNOWLEDGED: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["ACKNOWLEDGED", "RESOLVED", "CANCELLED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: ["IN_PROGRESS"],
  CANCELLED: ["OPEN"],
};

// A resident can only withdraw their own request while it hasn't been worked.
const RESIDENT_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  OPEN: ["CANCELLED"],
  ACKNOWLEDGED: ["CANCELLED"],
  IN_PROGRESS: [],
  RESOLVED: [],
  CLOSED: [],
  CANCELLED: [],
};

export function canTransitionMaintenance(
  from: MaintenanceStatus,
  to: MaintenanceStatus,
  actor: "staff" | "resident"
): boolean {
  if (from === to) return false;
  const map = actor === "staff" ? STAFF_TRANSITIONS : RESIDENT_TRANSITIONS;
  return map[from]?.includes(to) ?? false;
}

// Kept in sync with lib/maintenance-photos.ts (server-only — not imported client-side).
export const MAINTENANCE_PHOTO_ACCEPT = "image/png,image/jpeg,image/webp";
export const MAINTENANCE_PHOTO_MAX = 6;
