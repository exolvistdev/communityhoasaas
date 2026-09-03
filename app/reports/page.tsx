import Link from "next/link";
import {
  FileBarChart,
  Scale,
  AlarmClock,
  Wallet,
  Layers,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireStaff } from "@/lib/rbac";
import { zonedParts } from "@/lib/amenity";
import { parseReportRange } from "@/lib/reports";

const pad = (n: number) => String(n).padStart(2, "0");

export default async function ReportsIndex({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  await requireStaff();
  const range = parseReportRange(searchParams);
  const qs = `from=${range.fromYmd}&to=${range.toYmd}`;

  const n = zonedParts(new Date());
  const today = `${n.year}-${pad(n.month)}-${pad(n.day)}`;
  const monthStart = `${n.year}-${pad(n.month)}-01`;
  const qStartMonth = Math.floor((n.month - 1) / 3) * 3 + 1;
  const presets: { label: string; from: string; to: string }[] = [
    { label: "This month", from: monthStart, to: today },
    {
      label: "This quarter",
      from: `${n.year}-${pad(qStartMonth)}-01`,
      to: today,
    },
    { label: "Year to date", from: `${n.year}-01-01`, to: today },
    {
      label: "Last year",
      from: `${n.year - 1}-01-01`,
      to: `${n.year - 1}-12-31`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-gray-900">
          Financial reports
        </h1>
        <p className="text-sm text-gray-500">
          Pick a period, then open a report and print or save it as a PDF.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <form method="GET" className="flex flex-wrap items-end gap-3 text-sm">
          <label>
            <span className="block text-xs text-gray-500">From</span>
            <input
              type="date"
              name="from"
              defaultValue={range.fromYmd}
              className="mt-1 rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
            />
          </label>
          <label>
            <span className="block text-xs text-gray-500">To</span>
            <input
              type="date"
              name="to"
              defaultValue={range.toYmd}
              className="mt-1 rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-3 py-1.5 font-medium text-white hover:bg-gray-800"
          >
            Apply
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {presets.map((p) => (
            <Link
              key={p.label}
              href={`/reports?from=${p.from}&to=${p.to}`}
              className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-gray-600 hover:bg-gray-50"
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ReportCard
          href={`/reports/board-pack?${qs}`}
          icon={Layers}
          title="Board pack"
          sub="Everything below, bundled for a meeting"
          featured
        />
        <ReportCard
          href={`/reports/income-statement?${qs}`}
          icon={FileBarChart}
          title="Income & expenses"
          sub="Statement of income and expenses for the period"
        />
        <ReportCard
          href={`/reports/balance-sheet?${qs}`}
          icon={Scale}
          title="Financial position"
          sub="Assets, liabilities and fund balance as of the end date"
        />
        <ReportCard
          href={`/reports/aging?${qs}`}
          icon={AlarmClock}
          title="Receivables aging"
          sub="Delinquency by unit and age bucket"
        />
        <ReportCard
          href={`/reports/payables?${qs}`}
          icon={Truck}
          title="Payables aging"
          sub="Unpaid vendor bills by age bucket"
        />
        <ReportCard
          href={`/reports/collections?${qs}`}
          icon={Wallet}
          title="Collections summary"
          sub="Billed vs collected and the collection rate"
        />
      </div>
    </div>
  );
}

function ReportCard({
  href,
  icon: Icon,
  title,
  sub,
  featured,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  sub: string;
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
        featured
          ? "border-gray-900 bg-white sm:col-span-2"
          : "border-gray-200 bg-white"
      }`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
        <Icon className="h-4 w-4" />
      </span>
      <div className="mt-2.5 text-sm font-medium text-gray-900">{title}</div>
      <div className="mt-0.5 text-xs text-gray-500">{sub}</div>
    </Link>
  );
}
