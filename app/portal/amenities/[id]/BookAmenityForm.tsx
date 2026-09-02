"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bookingRuleViolations,
  labelHour,
  zonedDateInput,
  zonedInstant,
} from "@/lib/amenity";
import { bookAmenity } from "../actions";

type Rules = {
  openHour: number;
  closeHour: number;
  minNoticeHours: number;
  maxHours: number;
};

export function BookAmenityForm({
  amenityId,
  amenity,
  defaultDate,
  takenHours,
  minStartMs,
}: {
  amenityId: string;
  amenity: Rules;
  defaultDate: string;
  takenHours: number[];
  minStartMs: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [date, setDate] = useState(defaultDate);
  const [startHour, setStartHour] = useState(amenity.openHour);
  const [duration, setDuration] = useState(1);
  const [purpose, setPurpose] = useState("");

  const [y, mo, d] = date.split("-").map(Number);

  const startHours = useMemo(
    () =>
      Array.from(
        { length: Math.max(0, amenity.closeHour - amenity.openHour) },
        (_, i) => amenity.openHour + i
      ),
    [amenity.openHour, amenity.closeHour]
  );
  const durations = useMemo(
    () => Array.from({ length: amenity.maxHours }, (_, i) => i + 1),
    [amenity.maxHours]
  );

  const { startAt, endAt } = useMemo(() => {
    const s = zonedInstant(y, mo, d, startHour);
    return { startAt: s, endAt: new Date(s.getTime() + duration * 3_600_000) };
  }, [y, mo, d, startHour, duration]);

  const clientViolation = bookingRuleViolations(amenity, startAt, endAt)[0];

  const hourDisabled = (h: number) =>
    takenHours.includes(h) ||
    zonedInstant(y, mo, d, h).getTime() < minStartMs;

  function submit() {
    setError(null);
    setOk(null);
    if (clientViolation) {
      setError(clientViolation);
      return;
    }
    start(async () => {
      const res = await bookAmenity(amenityId, {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        purpose,
      });
      if (res.ok) {
        setOk(
          res.status === "CONFIRMED"
            ? "Booked — confirmed."
            : "Request sent — the HOA will review it."
        );
        setPurpose("");
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Book this amenity</h2>

      <label className="block text-sm">
        <span className="text-fg">Date</span>
        <input
          type="date"
          value={date}
          min={zonedDateInput(new Date())}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            setDate(v);
            router.replace(`/portal/amenities/${amenityId}?date=${v}`, {
              scroll: false,
            });
          }}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-fg">Start</span>
          <select
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-brand"
          >
            {startHours.map((h) => (
              <option key={h} value={h} disabled={hourDisabled(h)}>
                {labelHour(h)}
                {takenHours.includes(h) ? " (booked)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-fg">Length</span>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-brand"
          >
            {durations.map((h) => (
              <option key={h} value={h}>
                {h} hour{h === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-fg">Purpose (optional)</span>
        <input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          maxLength={300}
          placeholder="Kids' birthday party"
          className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </label>

      <p className="text-xs text-fg-subtle">
        {labelHour(startHour)}–{labelHour(startHour + duration)} on {date}
      </p>

      {(error || clientViolation) && (
        <p className="text-sm text-danger-fg">{error ?? clientViolation}</p>
      )}
      {ok && <p className="text-sm text-success-fg">{ok}</p>}

      <button
        onClick={submit}
        disabled={pending || Boolean(clientViolation)}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Booking…" : "Request booking"}
      </button>
    </div>
  );
}
