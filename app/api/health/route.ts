import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Liveness + DB-connectivity probe for uptime monitoring and post-deploy smoke
 * tests. Public (no auth, no tenancy). 200 when the database answers, 503 when
 * it doesn't.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", time: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { ok: false, db: "down", time: new Date().toISOString() },
      { status: 503 }
    );
  }
}
