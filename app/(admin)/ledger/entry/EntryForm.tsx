"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
import { recordManualEntry } from "../actions";

type Account = { code: string; name: string; type: string };
type Mode = "expense" | "income" | "advanced";
type Row = { code: string; debit: string; credit: string };

const today = () => new Date().toISOString().slice(0, 10);
const label = (a: Account) => `${a.code} — ${a.name}`;

export function EntryForm({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("expense");
  const [date, setDate] = useState(today());
  const [memo, setMemo] = useState("");
  const [amount, setAmount] = useState("");

  const expenseAccts = accounts.filter((a) => a.type === "EXPENSE");
  const incomeAccts = accounts.filter((a) => a.type === "INCOME");

  const [expenseCode, setExpenseCode] = useState(
    expenseAccts[0]?.code ?? ""
  );
  const [incomeCode, setIncomeCode] = useState(
    incomeAccts.find((a) => a.code === "4200")?.code ?? incomeAccts[0]?.code ?? ""
  );

  const [rows, setRows] = useState<Row[]>([
    { code: accounts[0]?.code ?? "", debit: "", credit: "" },
    { code: accounts[0]?.code ?? "", debit: "", credit: "" },
  ]);

  const advTotals = useMemo(() => {
    const d = rows.reduce((s, r) => s + (Number(r.debit) || 0), 0);
    const c = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
    return { d, c, balanced: Math.abs(d - c) < 0.005 && d > 0 };
  }, [rows]);

  function buildLines(): { code: string; debit: number; credit: number }[] {
    const amt = Number(amount) || 0;
    if (mode === "expense")
      return [
        { code: expenseCode, debit: amt, credit: 0 },
        { code: "1000", debit: 0, credit: amt },
      ];
    if (mode === "income")
      return [
        { code: "1000", debit: amt, credit: 0 },
        { code: incomeCode, debit: 0, credit: amt },
      ];
    return rows.map((r) => ({
      code: r.code,
      debit: Number(r.debit) || 0,
      credit: Number(r.credit) || 0,
    }));
  }

  const canSubmit =
    !!date &&
    memo.trim().length >= 2 &&
    (mode === "advanced"
      ? advTotals.balanced && rows.every((r) => r.code)
      : Number(amount) > 0);

  function submit() {
    setError(null);
    start(async () => {
      const res = await recordManualEntry({
        entryDate: date,
        memo: memo.trim(),
        lines: buildLines(),
      });
      if (res.ok) {
        router.push("/ledger?view=journal");
        router.refresh();
      } else setError(res.error);
    });
  }

  const field =
    "mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand";

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex gap-1.5">
        {(["expense", "income", "advanced"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1 text-sm capitalize ${
              mode === m
                ? "bg-brand text-white"
                : "border border-border text-fg-muted hover:bg-surface-2"
            }`}
          >
            {m === "expense"
              ? "Expense"
              : m === "income"
              ? "Other income"
              : "Advanced"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-fg">Date</span>
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            className={field}
          />
        </label>
        {mode !== "advanced" && (
          <label className="block text-sm">
            <span className="text-fg">Amount (₱)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={field}
            />
          </label>
        )}
      </div>

      {mode === "expense" && (
        <label className="block text-sm">
          <span className="text-fg">Expense account</span>
          <select
            value={expenseCode}
            onChange={(e) => setExpenseCode(e.target.value)}
            className={field}
          >
            {expenseAccts.map((a) => (
              <option key={a.code} value={a.code}>
                {label(a)}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-fg-subtle">
            Paid from Cash (1000).
          </span>
        </label>
      )}

      {mode === "income" && (
        <label className="block text-sm">
          <span className="text-fg">Income account</span>
          <select
            value={incomeCode}
            onChange={(e) => setIncomeCode(e.target.value)}
            className={field}
          >
            {incomeAccts.map((a) => (
              <option key={a.code} value={a.code}>
                {label(a)}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-fg-subtle">
            Received into Cash (1000).
          </span>
        </label>
      )}

      {mode === "advanced" && (
        <div className="space-y-2">
          <div className="space-y-2 overflow-x-auto">
          <div className="grid min-w-[26rem] grid-cols-[1fr_6rem_6rem_1.5rem] gap-2 text-xs font-medium text-fg-subtle">
            <span>Account</span>
            <span className="text-right">Debit</span>
            <span className="text-right">Credit</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid min-w-[26rem] grid-cols-[1fr_6rem_6rem_1.5rem] items-center gap-2"
            >
              <select
                value={r.code}
                onChange={(e) =>
                  setRows((rs) =>
                    rs.map((x, j) =>
                      j === i ? { ...x, code: e.target.value } : x
                    )
                  )
                }
                className="rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand"
              >
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {label(a)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={r.debit}
                onChange={(e) =>
                  setRows((rs) =>
                    rs.map((x, j) =>
                      j === i
                        ? { ...x, debit: e.target.value, credit: "" }
                        : x
                    )
                  )
                }
                className="rounded-md border border-border px-2 py-1.5 text-right text-sm outline-none focus:border-brand"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={r.credit}
                onChange={(e) =>
                  setRows((rs) =>
                    rs.map((x, j) =>
                      j === i
                        ? { ...x, credit: e.target.value, debit: "" }
                        : x
                    )
                  )
                }
                className="rounded-md border border-border px-2 py-1.5 text-right text-sm outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() =>
                  setRows((rs) =>
                    rs.length > 2 ? rs.filter((_, j) => j !== i) : rs
                  )
                }
                className="text-fg-subtle hover:text-danger-fg disabled:opacity-30"
                disabled={rows.length <= 2}
                aria-label="Remove line"
              >
                ×
              </button>
            </div>
          ))}
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setRows((rs) => [...rs, { code: accounts[0]?.code ?? "", debit: "", credit: "" }])
              }
              className="text-xs text-brand-accent hover:underline"
            >
              + Add line
            </button>
            <span
              className={`text-xs ${
                advTotals.balanced ? "text-success-fg" : "text-fg-muted"
              }`}
            >
              Debits {peso(advTotals.d)} · Credits {peso(advTotals.c)}
              {advTotals.balanced ? " · balanced" : ""}
            </span>
          </div>
        </div>
      )}

      <label className="block text-sm">
        <span className="text-fg">Description</span>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          maxLength={300}
          placeholder="e.g. August security services"
          className={field}
        />
      </label>

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !canSubmit}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post entry"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/ledger?view=journal")}
          className="rounded-md px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
