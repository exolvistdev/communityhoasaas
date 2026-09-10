import type { GatePassStatus } from "@prisma/client";

// Ambiguous characters (I, L, O, 0, 1) left out so codes read cleanly at a gate.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Pull a gate-pass code out of whatever a scanner / paste produced — a full
 * `…/pass/ABC123` URL, or the bare code.
 */
export function extractGatePassCode(raw: string): string {
  const m = raw.match(/\/pass\/([A-Za-z0-9]+)/);
  return (m ? m[1] : raw).trim().toUpperCase();
}

/**
 * A short, human-enterable gate-pass code, e.g. "K7M4PQ2R". The code is the only
 * credential a guard checks, so it must be unpredictable — drawn from a CSPRNG
 * (Web Crypto, works in Node and the browser), with rejection sampling to avoid
 * modulo bias across the 30-char alphabet.
 */
export function generateGatePassCode(length = 10) {
  const n = CODE_ALPHABET.length;
  const limit = 256 - (256 % n); // reject bytes at/above this to keep it uniform
  let out = "";
  while (out.length < length) {
    const bytes = new Uint8Array(length - out.length);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < limit) out += CODE_ALPHABET[b % n];
    }
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

export type GatePassVerdict =
  | "VALID"
  | "EXPIRED"
  | "NOT_YET_VALID"
  | "REVOKED"
  | "USED";

/** The guard-facing verdict: is this pass good to let the visitor in *right now*? */
export function validateGatePass(
  pass: {
    status: GatePassStatus;
    validFrom: Date;
    validUntil: Date;
    usedAt?: Date | null;
  },
  now: Date = new Date()
): GatePassVerdict {
  if (pass.status === "REVOKED") return "REVOKED";
  if (pass.status === "EXPIRED") return "EXPIRED";
  const t = now.getTime();
  if (t < pass.validFrom.getTime()) return "NOT_YET_VALID";
  if (t > pass.validUntil.getTime()) return "EXPIRED";
  if (pass.usedAt) return "USED";
  return "VALID";
}
