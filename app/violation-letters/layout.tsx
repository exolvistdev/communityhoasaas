import { getCurrentOrgContext } from "@/lib/tenant";

export const metadata = { title: "Demand letter · HOA SaaS" };

export default async function ViolationLetterLayout({
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
          body { background: #fff; }
          @page { margin: 18mm; }
        }
      `}</style>
      {children}
    </div>
  );
}
