import type { GatePassStatus } from "@prisma/client";

// Ambiguous characters (I, L, O, 0, 1) left out so codes read cleanly at a gate.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A short, human-enterable gate-pass code, e.g. "K7M4PQ2R". */
export function generateGatePassCode(length = 8) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/** Show EXPIRED for active passes whose window has closed, without a cron job
 *  flipping the stored status. Mirrors `effectiveStatus` in lib/invoice.ts. */
export function effectiveGatePassStatus(pass: {
  status: GatePassStatus;
  validUntil: Date;
}): GatePassStatus {
  if (pass.status === "ACTIVE" && pass.validUntil.getTime() < Date.now()) {
    return "EXPIRED";
  }
  return pass.status;
}
