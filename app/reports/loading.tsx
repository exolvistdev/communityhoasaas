import { HouseBuildingLoader } from "@/components/HouseBuildingLoader";

/** Fallback for every `reports/*` route — none of them define their own. */
export default function ReportsLoading() {
  return <HouseBuildingLoader />;
}
