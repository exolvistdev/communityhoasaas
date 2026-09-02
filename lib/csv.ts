import { z } from "zod";
import { typeDefaultRate, type TypeRateDefaults } from "@/lib/rate";

/* ── CSV writing ──────────────────────────────────────────────────────
 * Shared by every downloadable-CSV route handler. */

/** Quote a cell if it contains a comma, quote or newline; double embedded quotes. */
export function csvCell(v: string | number | null | undefined) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows (including the header row) → a CRLF-joined CSV string. */
export function toCsvString(rows: (string | number | null | undefined)[][]) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Build a downloadable-file Response for a CSV string. */
export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export type RawRow = Record<string, string>;

export type ValidRow = {
  unitNumber: string;
  type: "RESIDENTIAL" | "COMMERCIAL" | "TOWNHOUSE";
  monthlyRate: number;
  homeownerName?: string;
  homeownerEmail?: string;
  homeownerPhone?: string;
};

export type RowError = { line: number; field: string; message: string };

export type ParseResult = {
  valid: ValidRow[];
  errors: RowError[];
  /** header keys we could not map to a known column */
  missingColumns: string[];
};

type Field = keyof ValidRow;

const HEADER_ALIASES: Record<string, Field> = {
  unit: "unitNumber",
  "unit number": "unitNumber",
  unit_number: "unitNumber",
  unitnumber: "unitNumber",
  type: "type",
  "property type": "type",
  property_type: "type",
  rate: "monthlyRate",
  "monthly rate": "monthlyRate",
  monthly_rate: "monthlyRate",
  monthlyrate: "monthlyRate",
  dues: "monthlyRate",
  // optional homeowner columns
  homeowner: "homeownerName",
  "homeowner name": "homeownerName",
  homeowner_name: "homeownerName",
  owner: "homeownerName",
  "owner name": "homeownerName",
  name: "homeownerName",
  email: "homeownerEmail",
  "homeowner email": "homeownerEmail",
  "owner email": "homeownerEmail",
  phone: "homeownerPhone",
  "homeowner phone": "homeownerPhone",
  "contact number": "homeownerPhone",
  mobile: "homeownerPhone",
};

// monthlyRate is not required — a row with no rate falls back to the org's
// default for its property type (see validateRows opts).
const REQUIRED: Field[] = ["unitNumber", "type"];

const TYPE_MAP: Record<string, ValidRow["type"]> = {
  residential: "RESIDENTIAL",
  res: "RESIDENTIAL",
  commercial: "COMMERCIAL",
  com: "COMMERCIAL",
  townhouse: "TOWNHOUSE",
  th: "TOWNHOUSE",
};

const rowSchema = z.object({
  unitNumber: z.string().trim().min(1, "Unit number is required"),
  type: z.string().trim().transform((v, ctx) => {
    const mapped = TYPE_MAP[v.toLowerCase()];
    if (!mapped) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown type "${v}" (use residential, commercial, or townhouse)`,
      });
      return z.NEVER;
    }
    return mapped;
  }),
  monthlyRate: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined; // blank / missing → resolved from the type default
      const n = Number(v.replace(/[₱,\s]/g, ""));
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid monthly rate "${v}"`,
        });
        return z.NEVER;
      }
      return n;
    }),
  homeownerName: z.string().trim().optional(),
  homeownerEmail: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid email "${v}"`,
        });
        return z.NEVER;
      }
      return v;
    }),
  homeownerPhone: z.string().trim().optional(),
});

/** Map arbitrary CSV headers onto our canonical field names. */
function resolveHeaders(headers: string[]) {
  const map = new Map<string, Field>();
  for (const h of headers) {
    const key = HEADER_ALIASES[h.trim().toLowerCase()];
    if (key && !new Set(map.values()).has(key)) map.set(h, key);
  }
  const found = new Set(map.values());
  const missing = REQUIRED.filter((k) => !found.has(k));
  return { map, missing };
}

/**
 * Validate rows already parsed from CSV text (header: true).
 * Line numbers are 1-based and refer to the data row (row 1 = first row
 * after the header), matching what a user sees in a spreadsheet minus one.
 */
export function validateRows(
  rawRows: RawRow[],
  opts: { typeDefaults?: TypeRateDefaults } = {}
): ParseResult {
  const headers = rawRows.length ? Object.keys(rawRows[0]) : [];
  const { map, missing } = resolveHeaders(headers);

  if (missing.length) {
    return {
      valid: [],
      errors: [],
      missingColumns: missing.map((m) =>
        m === "unitNumber" ? "unit number" : m === "monthlyRate" ? "monthly rate" : m
      ),
    };
  }

  const valid: ValidRow[] = [];
  const errors: RowError[] = [];
  const seen = new Map<string, number>();

  rawRows.forEach((raw, i) => {
    const line = i + 1;
    const canonical: RawRow = {};
    for (const [orig, key] of map) canonical[key] = raw[orig] ?? "";

    // skip fully blank lines
    if (Object.values(canonical).every((v) => !v?.trim())) return;

    const parsed = rowSchema.safeParse(canonical);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({
          line,
          field: String(issue.path[0] ?? ""),
          message: issue.message,
        });
      }
      return;
    }

    const dupLine = seen.get(parsed.data.unitNumber.toLowerCase());
    if (dupLine) {
      errors.push({
        line,
        field: "unitNumber",
        message: `Duplicate unit number (also on row ${dupLine})`,
      });
      return;
    }
    seen.set(parsed.data.unitNumber.toLowerCase(), line);

    let monthlyRate = parsed.data.monthlyRate;
    if (monthlyRate === undefined) {
      const fallback = opts.typeDefaults
        ? typeDefaultRate(opts.typeDefaults, parsed.data.type)
        : null;
      if (fallback === null) {
        errors.push({
          line,
          field: "monthlyRate",
          message:
            "No monthly rate, and no default set for this property type — add a rate column or set type defaults in Settings",
        });
        return;
      }
      monthlyRate = fallback;
    }

    const row: ValidRow = {
      unitNumber: parsed.data.unitNumber,
      type: parsed.data.type,
      monthlyRate,
    };
    if (parsed.data.homeownerName) row.homeownerName = parsed.data.homeownerName;
    if (parsed.data.homeownerEmail) row.homeownerEmail = parsed.data.homeownerEmail;
    if (parsed.data.homeownerPhone) row.homeownerPhone = parsed.data.homeownerPhone;
    valid.push(row);
  });

  return { valid, errors, missingColumns: [] };
}
