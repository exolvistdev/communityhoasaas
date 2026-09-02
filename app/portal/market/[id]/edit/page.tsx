import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { ListingForm } from "../../ListingForm";

export const metadata = { title: "Edit listing · HOA SaaS" };

export default async function EditListingPage({
  params,
}: {
  params: { id: string };
}) {
  const { user, org } = await getHomeownerContext();
  const listing = await prisma.marketplaceListing.findFirst({
    where: { id: params.id, orgId: org.id },
  });
  if (!listing || listing.sellerId !== user.id) notFound();

  return (
    <div className="space-y-4">
      <Link
        href={`/portal/market/${listing.id}`}
        className="text-sm text-fg-muted hover:text-fg"
      >
        ← Back to listing
      </Link>
      <h1 className="text-lg font-semibold text-fg">Edit listing</h1>
      <ListingForm
        initial={{
          id: listing.id,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          price: Number(listing.price),
          photos: listing.photos,
        }}
      />
    </div>
  );
}
