import type { PrismaClient } from "@prisma/client";

/**
 * Set monthlyRate = round(ratePerSqm × floorArea, 2) for every non-plan,
 * non-archived property in the org that has a floor area. Returns the row count.
 * A single SQL statement — `updateMany` can't multiply two columns.
 */
export async function reapplyPerSqm(
  db: PrismaClient,
  orgId: string,
  ratePerSqm: number
): Promise<number> {
  return db.$executeRaw`
    UPDATE "properties"
       SET "monthlyRate" = ROUND(${ratePerSqm}::numeric * "floorArea", 2)
     WHERE "orgId" = ${orgId}
       AND "ratePlanId" IS NULL
       AND "archivedAt" IS NULL
       AND "floorArea" IS NOT NULL`;
}
