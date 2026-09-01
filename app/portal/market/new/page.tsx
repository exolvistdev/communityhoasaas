import Link from "next/link";
import { getHomeownerContext } from "@/lib/portal";
import { ListingForm } from "../ListingForm";

export const metadata = { title: "New listing · HOA SaaS" };

export default async function NewListingPage() {
  await getHomeownerContext();

  return (
    <div className="space-y-4">
      <Link
        href="/portal/market"
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        ← Marketplace
      </Link>
      <h1 className="text-lg font-semibold text-gray-900">New listing</h1>
      <p className="text-sm text-gray-500">
        Visible to residents of your HOA only. Buyers reach you through in-app
        messages — your contact details stay private.
      </p>
      <ListingForm />
    </div>
  );
}
