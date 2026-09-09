-- Condominium parking slots are separately titled and pay their own dues, so
-- they are first-class Property rows. Own migration per repo rule (new enum
-- value commits before it is used).
ALTER TYPE "PropertyType" ADD VALUE 'PARKING_SLOT';
