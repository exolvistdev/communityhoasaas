import { describe, it, expect } from "vitest";
import { csvCell, toCsvString, validateRows, type RawRow } from "@/lib/csv";

describe("csvCell", () => {
  it("leaves a plain value untouched", () => {
    expect(csvCell("Blk 1 Lot 1")).toBe("Blk 1 Lot 1");
    expect(csvCell(1500)).toBe("1500");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes and escapes when a cell has a comma, quote or newline", () => {
    expect(csvCell("Reyes, Ana")).toBe('"Reyes, Ana"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("toCsvString", () => {
  it("joins rows with CRLF", () => {
    expect(
      toCsvString([
        ["unit", "rate"],
        ["A, 1", 1500],
      ])
    ).toBe('unit,rate\r\n"A, 1",1500');
  });
});

describe("validateRows", () => {
  it("maps header aliases, normalises type, strips ₱ and commas from the rate", () => {
    const rows: RawRow[] = [
      { Unit: "Blk 1 Lot 1", "Property Type": "residential", Dues: "₱1,500" },
      { Unit: "Blk 1 Lot 2", "Property Type": "TH", Dues: "2200" },
    ];
    const res = validateRows(rows);
    expect(res.errors).toEqual([]);
    expect(res.valid).toEqual([
      { unitNumber: "Blk 1 Lot 1", type: "RESIDENTIAL", monthlyRate: 1500 },
      { unitNumber: "Blk 1 Lot 2", type: "TOWNHOUSE", monthlyRate: 2200 },
    ]);
  });

  it("short-circuits with missingColumns when a required header is absent", () => {
    const res = validateRows([{ Unit: "A", Dues: "1500" }]);
    expect(res.missingColumns).toEqual(["type"]);
    expect(res.valid).toEqual([]);
  });

  it("reports a bad email and an unknown type by line number", () => {
    const res = validateRows([
      { unit: "A", type: "residential", rate: "1500", email: "ana@example.com" },
      { unit: "B", type: "residential", rate: "1500", email: "not-an-email" },
      { unit: "C", type: "castle", rate: "1500" },
    ]);
    expect(res.valid).toHaveLength(1);
    expect(res.errors.find((e) => e.field === "homeownerEmail")?.line).toBe(2);
    expect(res.errors.find((e) => e.field === "type")?.line).toBe(3);
  });

  it("flags a duplicate unit number and points at the first occurrence", () => {
    const res = validateRows([
      { unit: "Blk 1 Lot 1", type: "res", rate: "1500" },
      { unit: "blk 1 lot 1", type: "res", rate: "1600" },
    ]);
    expect(res.valid).toHaveLength(1);
    expect(res.errors[0]).toMatchObject({ field: "unitNumber", line: 2 });
    expect(res.errors[0].message).toContain("row 1");
  });

  it("rejects a negative rate", () => {
    const res = validateRows([{ unit: "A", type: "res", rate: "-100" }]);
    expect(res.errors[0].field).toBe("monthlyRate");
  });

  it("skips fully blank lines", () => {
    const res = validateRows([
      { unit: "A", type: "res", rate: "1500" },
      { unit: "", type: "", rate: "" },
    ]);
    expect(res.valid).toHaveLength(1);
    expect(res.errors).toEqual([]);
  });
});
