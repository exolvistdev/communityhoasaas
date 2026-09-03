-- Adding a value to an existing enum must be its own migration. Also mirrored
-- in the schema.prisma NotificationType block.
ALTER TYPE "NotificationType" ADD VALUE 'BOARD_MEETING';
