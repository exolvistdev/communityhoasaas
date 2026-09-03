import Link from "next/link";
import { getHomeownerContext } from "@/lib/portal";
import { NewRequestForm } from "./NewRequestForm";

export const metadata = { title: "New request · HOA SaaS" };

export default async function NewMaintenanceRequestPage() {
  const { property } = await getHomeownerContext();

  return (
    <div className="space-y-4">
      <Link
        href="/portal/maintenance"
        className="text-sm text-fg-muted hover:text-fg"
      >
        ← Requests
      </Link>
      <h1 className="text-lg font-semibold text-fg">Report a repair</h1>
      <NewRequestForm unitNumber={property?.unitNumber ?? null} />
    </div>
  );
}
