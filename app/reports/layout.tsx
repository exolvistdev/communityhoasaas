import { requireStaff } from "@/lib/rbac";

export const metadata = { title: "Reports · HOA SaaS" };

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff(); // staff-only; homeowners see financials as documents

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 print:max-w-none print:p-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .break-after-page { break-after: page; }
          body { background: #fff; }
          @page { margin: 16mm; }
          /* long report tables: repeat the header on each page, never split a row */
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
        }
      `}</style>
      {children}
    </div>
  );
}
