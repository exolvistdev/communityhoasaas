import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { isStaff } from "@/lib/permissions";
import { documentSignedUrl } from "@/lib/documents";

export const dynamic = "force-dynamic";

/**
 * Resolve a document to a short-lived signed URL and redirect to it.
 * Staff and homeowners of the same org may fetch; `staffOnly` docs require staff.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { org, user } = await getCurrentOrgContext();

  const doc = await prisma.document.findUnique({ where: { id: params.id } });
  if (!doc || doc.orgId !== org.id)
    return new NextResponse("Not found", { status: 404 });
  if (doc.staffOnly && !isStaff(user.role))
    return new NextResponse("Not found", { status: 404 });

  const url = await documentSignedUrl(doc.storagePath);
  if (!url) return new NextResponse("File unavailable", { status: 502 });

  return NextResponse.redirect(url);
}
