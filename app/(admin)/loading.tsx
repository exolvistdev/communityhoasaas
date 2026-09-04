import { HouseBuildingLoader } from "@/components/HouseBuildingLoader";

/**
 * Fallback for every `(admin)/*` route that doesn't define its own
 * loading.tsx (dashboard/billing/ledger do; everything else cascades here).
 */
export default function AdminLoading() {
  return <HouseBuildingLoader />;
}
