import { peso } from "@/lib/format";
import { VIOLATION_CATEGORY_LABEL } from "@/lib/violation";
import type { ViolationCategory } from "@prisma/client";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" });

export type DemandLetterData = {
  orgName: string;
  contactEmail: string | null;
  paymentInstructions: string | null;
  unitNumber: string;
  homeownerName: string | null;
  category: ViolationCategory;
  description: string;
  occurredAt: Date;
  notices: {
    noticeNumber: number;
    amount: number;
    dueDate: Date;
    outstanding: number;
  }[];
  totalOutstanding: number;
  payByDate: Date | null;
};

export function DemandLetterDoc({ d }: { d: DemandLetterData }) {
  return (
    <article className="bg-white p-8 text-sm leading-relaxed text-gray-900 print:p-0">
      <header className="border-b border-gray-300 pb-4">
        <div className="text-lg font-semibold">{d.orgName}</div>
        <div className="text-gray-500">Notice of Violation &amp; Demand for Payment</div>
      </header>

      <div className="mt-6 text-gray-600">{fmtDate(new Date())}</div>

      <div className="mt-4">
        <div>{d.homeownerName ?? "The Homeowner"}</div>
        <div>Unit {d.unitNumber}</div>
      </div>

      <p className="mt-6">Dear {d.homeownerName ?? "Homeowner"},</p>

      <p className="mt-3">
        Our records show a{" "}
        <strong>{VIOLATION_CATEGORY_LABEL[d.category].toLowerCase()}</strong>{" "}
        violation of the community rules at your unit, observed on{" "}
        {fmtDate(d.occurredAt)}:
      </p>

      <p className="mt-2 border-l-2 border-gray-300 pl-3 text-gray-700">
        {d.description}
      </p>

      {d.notices.length > 0 && (
        <>
          <p className="mt-5">
            The following fine{d.notices.length === 1 ? " has" : "s have"} been
            assessed and billed to your account:
          </p>
          <table className="mt-2 w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-300 text-left text-gray-500">
                <th className="py-1.5 pr-4 font-medium">Notice</th>
                <th className="py-1.5 pr-4 font-medium">Due</th>
                <th className="py-1.5 pr-4 text-right font-medium">Assessed</th>
                <th className="py-1.5 text-right font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {d.notices.map((n) => (
                <tr key={n.noticeNumber} className="border-b border-gray-100">
                  <td className="py-1.5 pr-4">Notice #{n.noticeNumber}</td>
                  <td className="py-1.5 pr-4">{fmtDate(n.dueDate)}</td>
                  <td className="py-1.5 pr-4 text-right">{peso(n.amount)}</td>
                  <td className="py-1.5 text-right">{peso(n.outstanding)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-semibold">
                <td className="py-1.5 pr-4" colSpan={3}>
                  Total now due
                </td>
                <td className="py-1.5 text-right">{peso(d.totalOutstanding)}</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}

      <p className="mt-5">
        Please settle the outstanding balance of{" "}
        <strong>{peso(d.totalOutstanding)}</strong>
        {d.payByDate ? <> on or before <strong>{fmtDate(d.payByDate)}</strong></> : null}. Continued
        non-compliance may result in further fines and referral to the Board.
      </p>

      {d.paymentInstructions && (
        <p className="mt-4 whitespace-pre-wrap text-gray-700">
          {d.paymentInstructions}
        </p>
      )}

      <p className="mt-6">
        If you believe this notice was issued in error, you may contact the HOA
        office{d.contactEmail ? ` at ${d.contactEmail}` : ""} or file an appeal
        through the resident portal.
      </p>

      <p className="mt-6">Respectfully,</p>
      <p className="mt-6 font-medium">{d.orgName}</p>
    </article>
  );
}
