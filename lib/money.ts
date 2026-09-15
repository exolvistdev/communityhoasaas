import { z } from "zod";

/**
 * Shared cap for a positive peso amount coming from a form (payments,
 * refunds, bills). `.finite()` rejects `Infinity`/`NaN`; `.max()` keeps a
 * stray extra digit or unit conversion mistake from becoming an absurd value
 * that still clears the `positive()` check. Default cap (9,999,999,999)
 * comfortably covers any real HOA due/payment while still fitting a
 * `Decimal(12,2)` column; pass a tighter `max` for a field with its own
 * deliberately smaller ceiling (e.g. a single vendor bill line).
 */
export const moneyAmountSchema = (
  message = "Enter an amount greater than 0",
  max = 9_999_999_999
) => z.coerce.number().positive(message).finite().max(max);
