-- A common-area water meter (clubhouse, park). Enum value added on its own so a
-- later migration can use it in the same deploy.
ALTER TYPE "WaterMeterKind" ADD VALUE 'COMMON';
