import type {
  InvoiceStatus,
  GatePassStatus,
  AmenityBookingStatus,
  ListingStatus,
  PaymentStatus,
} from "@prisma/client";
import { Badge, type BadgeTone } from "@/components/ui/badge";

export { Badge } from "@/components/ui/badge";

const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

const invoice: Record<InvoiceStatus, [BadgeTone, string]> = {
  DRAFT: ["neutral", "Draft"],
  SENT: ["info", "Sent"],
  PARTIALLY_PAID: ["warning", "Partial"],
  PAID: ["success", "Paid"],
  OVERDUE: ["danger", "Overdue"],
  VOID: ["neutral", "Void"],
};

const gatePass: Record<GatePassStatus, BadgeTone> = {
  ACTIVE: "success",
  EXPIRED: "neutral",
  REVOKED: "danger",
};

const booking: Record<AmenityBookingStatus, BadgeTone> = {
  PENDING: "warning",
  CONFIRMED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

const listing: Record<ListingStatus, BadgeTone> = {
  ACTIVE: "success",
  SOLD: "neutral",
  WITHDRAWN: "warning",
  REMOVED: "danger",
};

const payment: Record<PaymentStatus, BadgeTone> = {
  PENDING: "warning",
  CONFIRMED: "success",
  REJECTED: "danger",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const [tone, label] = invoice[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function GatePassStatusBadge({ status }: { status: GatePassStatus }) {
  return <Badge tone={gatePass[status]}>{cap(status)}</Badge>;
}

export function AmenityBookingStatusBadge({
  status,
}: {
  status: AmenityBookingStatus;
}) {
  return <Badge tone={booking[status]}>{cap(status)}</Badge>;
}

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return <Badge tone={listing[status]}>{cap(status)}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={payment[status]}>{cap(status)}</Badge>;
}
