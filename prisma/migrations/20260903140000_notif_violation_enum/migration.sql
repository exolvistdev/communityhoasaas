-- Adding a value to an existing enum must be its own migration. Also mirrored
-- in the schema.prisma NotificationType block (Prisma generates from the schema).
ALTER TYPE "NotificationType" ADD VALUE 'VIOLATION_NOTICE';
