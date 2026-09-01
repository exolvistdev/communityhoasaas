import type { InvoiceStatus, GatePassStatus } from "@prisma/client";

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const toneClass: Record<Tone, string> = {
  success: "bg-green-100 text-green-800 ring-green-600/20",
  warning: "bg-amber-100 text-amber-800 ring-amber-600/20",
  danger: "bg-red-100 text-red-800 ring-red-600/20",
  neutral: "bg-gray-100 text-gray-700 ring-gray-500/20",
  info: "bg-blue-100 text-blue-800 ring-blue-600/20",
};

const invoiceTone: Record<InvoiceStatus, Tone> = {
  DRAFT: "neutral",
  SENT: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  VOID: "neutral",
};

const invoiceLabel: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIALLY_PAID: "Partial",
  PAID: "Paid",
  OVERDUE: "Overdue",
  VOID: "Void",
};

const gatePassTone: Record<GatePassStatus, Tone> = {
  ACTIVE: "success",
  EXPIRED: "neutral",
  REVOKED: "danger",
};

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={invoiceTone[status]}>{invoiceLabel[status]}</Badge>;
}

export function GatePassStatusBadge({ status }: { status: GatePassStatus }) {
  return (
    <Badge tone={gatePassTone[status]}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}
