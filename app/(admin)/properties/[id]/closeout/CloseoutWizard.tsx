"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
import { runCloseout } from "./actions";

type Mode = "TRANSFER" | "VACATE";
type Settlement = "SETTLED" | "WRITTEN_OFF" | "CARRIED_TO_NEW_OWNER";

const today = () => new Date().toISOString().slice(0, 10);

export function CloseoutWizard({
  propertyId,
  unitNumber,
  outstanding,
}: {
  propertyId: string;
  unitNumber: string;
  outstanding: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const owes = outstanding > 0.005;

  const [mode, setMode] = useState<Mode>("TRANSFER");
  const [settlement, setSettlement] = useState<Settlement>(
    owes ? "WRITTEN_OFF" : "SETTLED"
  );
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [note, setNote] = useState("");

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"OWNER" | "CO_OWNER" | "RENTER">("OWNER");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [invite, setInvite] = useState(true);

  const effectiveSettlement: Settlement = !owes
    ? "SETTLED"
    : mode === "VACATE" && settlement === "CARRIED_TO_NEW_OWNER"
    ? "WRITTEN_OFF"
    : settlement;

  const field =
    "mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand";

  function submit() {
    setError(null);
    if (mode === "TRANSFER" && !fullName.trim()) {
      setError("Enter the new owner's name");
      return;
    }
    const summary =
      mode === "VACATE"
        ? `Close out ${unitNumber} as vacated${
            owes ? ` and write off ${peso(outstanding)}` : ""
          }?`
        : `Transfer ${unitNumber} to ${fullName.trim()}${
            owes
              ? effectiveSettlement === "WRITTEN_OFF"
                ? ` and write off ${peso(outstanding)}`
                : ` (new owner takes on ${peso(outstanding)})`
              : ""
          }?`;
    if (!confirm(summary)) return;

    start(async () => {
      const res = await runCloseout(propertyId, {
        settlement: effectiveSettlement,
        vacated: mode === "VACATE",
        effectiveDate,
        note: note.trim() || undefined,
        newOwner:
          mode === "TRANSFER"
            ? {
                fullName: fullName.trim(),
                role,
                email: email.trim() || undefined,
                phone: phone.trim() || undefined,
                invite,
              }
            : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.inviteLink) {
        setInviteLink(res.inviteLink);
      } else {
        router.push(`/properties/${propertyId}`);
        router.refresh();
      }
    });
  }

  if (inviteLink) {
    return (
      <div className="space-y-3 rounded-lg border border-success/30 bg-success-subtle p-4 text-sm">
        <p className="font-medium text-success-fg">
          {unitNumber} closed out. Send the new owner their portal invite:
        </p>
        <code className="block break-all rounded bg-surface px-2 py-1.5 text-xs">
          {inviteLink}
        </code>
        <button
          onClick={() => {
            router.push(`/properties/${propertyId}`);
            router.refresh();
          }}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      {/* mode */}
      <div>
        <div className="text-sm font-medium text-fg">What&apos;s happening?</div>
        <div className="mt-2 space-y-1.5 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mode === "TRANSFER"}
              onChange={() => setMode("TRANSFER")}
            />
            <span className="text-fg">A new owner is taking over</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mode === "VACATE"}
              onChange={() => setMode("VACATE")}
            />
            <span className="text-fg">
              The unit is being vacated (no replacement — it will be archived)
            </span>
          </label>
        </div>
      </div>

      {/* settlement */}
      {owes && (
        <div className="border-t border-border pt-4">
          <div className="text-sm font-medium text-fg">
            What happens to the {peso(outstanding)} owed?
          </div>
          <div className="mt-2 space-y-1.5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={effectiveSettlement === "WRITTEN_OFF"}
                onChange={() => setSettlement("WRITTEN_OFF")}
              />
              <span className="text-fg">
                Write it off (uncollectible — posts to Bad Debt Expense)
              </span>
            </label>
            {mode === "TRANSFER" && (
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={effectiveSettlement === "CARRIED_TO_NEW_OWNER"}
                  onChange={() => setSettlement("CARRIED_TO_NEW_OWNER")}
                />
                <span className="text-fg">
                  The new owner takes it on (stays on the unit)
                </span>
              </label>
            )}
          </div>
        </div>
      )}

      {/* new owner */}
      {mode === "TRANSFER" && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="text-sm font-medium text-fg">New owner</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-fg">Full name</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={field}
              />
            </label>
            <label className="block text-sm">
              <span className="text-fg">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className={field}
              >
                <option value="OWNER">Owner</option>
                <option value="CO_OWNER">Co-owner</option>
                <option value="RENTER">Renter</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-fg">Email (optional)</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
              />
            </label>
            <label className="block text-sm">
              <span className="text-fg">Phone (optional)</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={field}
              />
            </label>
          </div>
          {email.trim() && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={invite}
                onChange={(e) => setInvite(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-fg">Send a portal invite now</span>
            </label>
          )}
        </div>
      )}

      {/* effective date + note */}
      <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-fg">Effective date</span>
          <input
            type="date"
            value={effectiveDate}
            max={today()}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className={field}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-fg">Note (optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="e.g. sold to; deed of sale on file"
          className={field}
        />
      </label>

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <button
        onClick={submit}
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Working…" : "Close out unit"}
      </button>
    </div>
  );
}
