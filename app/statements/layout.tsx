import { getCurrentOrgContext } from "@/lib/tenant";

export const metadata = { title: "Statements · HOA SaaS" };

export default async function StatementsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getCurrentOrgContext(); // auth + tenant gate

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:p-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .break-after-page { break-after: page; }
          body { background: #fff; }
          @page { margin: 16mm; }
        }
      `}</style>
      {children}
    </div>
  );
}
