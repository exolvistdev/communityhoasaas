import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { isStaff } from "@/lib/permissions";
import { maintenancePhotoSignedUrl } from "@/lib/maintenance-photos";

export const dynamic = "force-dynamic";

/**
 * Serve one maintenance-request photo as a signed-URL redirect.
 * `id` is the request id; `?i=` is the photo index. Visible to staff of the
 * org, or the resident who filed the request.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { org, user } = await getCurrentOrgContext();

  const request = await prisma.maintenanceRequest.findUnique({
    where: { id: params.id },
    select: { orgId: true, requesterId: true, photos: true },
  });
  if (!request || request.orgId !== org.id)
    return new NextResponse("Not found", { status: 404 });

  if (!isStaff(user.role) && request.requesterId !== user.id)
    return new NextResponse("Not found", { status: 404 });

  const i = Number(new URL(req.url).searchParams.get("i") ?? "0");
  const path = request.photos[i];
  if (!path) return new NextResponse("Not found", { status: 404 });

  const url = await maintenancePhotoSignedUrl(path);
  if (!url) return new NextResponse("File unavailable", { status: 502 });

  return NextResponse.redirect(url);
}
