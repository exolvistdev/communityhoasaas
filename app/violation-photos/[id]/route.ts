import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { isStaff } from "@/lib/permissions";
import { violationPhotoSignedUrl } from "@/lib/violation-photos";

export const dynamic = "force-dynamic";

/**
 * Serve one violation photo as a short-lived signed URL redirect.
 * `id` is the violation id; `?i=` is the photo index. Visible to staff of the
 * org, or a resident linked to the cited unit.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { org, user } = await getCurrentOrgContext();

  const violation = await prisma.violation.findUnique({
    where: { id: params.id },
    select: {
      orgId: true,
      photos: true,
      property: { select: { homeowners: { select: { userId: true } } } },
    },
  });
  if (!violation || violation.orgId !== org.id)
    return new NextResponse("Not found", { status: 404 });

  const linked = violation.property.homeowners.some((h) => h.userId === user.id);
  if (!isStaff(user.role) && !linked)
    return new NextResponse("Not found", { status: 404 });

  const i = Number(new URL(req.url).searchParams.get("i") ?? "0");
  const path = violation.photos[i];
  if (!path) return new NextResponse("Not found", { status: 404 });

  const url = await violationPhotoSignedUrl(path);
  if (!url) return new NextResponse("File unavailable", { status: 502 });

  return NextResponse.redirect(url);
}
