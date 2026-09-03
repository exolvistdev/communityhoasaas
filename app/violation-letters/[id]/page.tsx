import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PrintToolbar } from "@/components/PrintToolbar";
import { DemandLetterDoc, type DemandLetterData } from "@/components/DemandLetterDoc";

export default async function ViolationLetterPage({
  params,
}: {
  params: { id: string };
}) {
  const { org } = await requirePermission("violation:manage");

  const violation = await prisma.violation.findFirst({
    where: { id: params.id, orgId: org.id },
    include: {
      property: {
        select: {
          unitNumber: true,
          homeowners: { orderBy: { isPrimary: "desc" }, select: { fullName: true } },
        },
      },
      fineNotices: {
        orderBy: { noticeNumber: "asc" },
        include: {
          invoice: {
            select: {
              status: true,
              amount: true,
              allocations: {
                where: { payment: { status: "CONFIRMED" } },
                select: { amount: true },
              },
              creditApplications: { select: { amount: true } },
            },
          },
        },
      },
    },
  });
  if (!violation) notFound();

  const notices = violation.fineNotices
    .filter((fn) => fn.invoice && fn.invoice.status !== "VOID")
    .map((fn) => {
      const inv = fn.invoice!;
      const paid =
        inv.allocations.reduce((s, x) => s + Number(x.amount), 0) +
        inv.creditApplications.reduce((s, x) => s + Number(x.amount), 0);
      return {
        noticeNumber: fn.noticeNumber,
        amount: Number(fn.amount),
        dueDate: fn.dueDate,
        outstanding: Math.max(Number(inv.amount) - paid, 0),
      };
    });

  const totalOutstanding = notices.reduce((s, n) => s + n.outstanding, 0);
  const payByDate =
    notices.length > 0
      ? notices.reduce(
          (min, n) => (n.dueDate < min ? n.dueDate : min),
          notices[0].dueDate
        )
      : null;

  const data: DemandLetterData = {
    orgName: org.name,
    contactEmail: org.privacyContactEmail,
    paymentInstructions: org.paymentInstructions,
    unitNumber: violation.property.unitNumber,
    homeownerName: violation.property.homeowners[0]?.fullName ?? null,
    category: violation.category,
    description: violation.description,
    occurredAt: violation.occurredAt,
    notices,
    totalOutstanding,
    payByDate,
  };

  return (
    <>
      <PrintToolbar
        backHref={`/violations/${violation.id}`}
        backLabel="Back to violation"
      />
      <DemandLetterDoc d={data} />
    </>
  );
}
