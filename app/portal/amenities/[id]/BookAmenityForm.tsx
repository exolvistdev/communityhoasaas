"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bookingRuleViolations,
  labelHour,
  toDateInput,
} from "@/lib/amenity";
import { bookAmenity } from "../actions";

type Rules = {
  openHour: number;
  closeHour: number;
  minNoticeHours: number;
  maxHours: number;
};

function combine(dateStr: string, hour: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

export function BookAmenityForm({
  amenityId,
  amenity,
  defaultDate,
}: {
  amenityId: string;
  amenity: Rules;
  defaultDate: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [date, setDate] = useState(defaultDate);
  const [startHour, setStartHour] = useState(amenity.openHour);
  const [duration, setDuration] = useState(1);
  const [purpose, setPurpose] = useState("");

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
    const s = combine(date, startHour);
    return { startAt: s, endAt: new Date(s.getTime() + duration * 3_600_000) };
  }, [date, startHour, duration]);

  const clientViolation = bookingRuleViolations(amenity, startAt, endAt)[0];

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
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">Book this amenity</h2>

      <label className="block text-sm">
        <span className="text-gray-700">Date</span>
        <input
          type="date"
          value={date}
          min={toDateInput(new Date())}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-gray-700">Start</span>
          <select
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-gray-900"
          >
            {startHours.map((h) => (
              <option key={h} value={h}>
                {labelHour(h)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Length</span>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-gray-900"
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
        <span className="text-gray-700">Purpose (optional)</span>
        <input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          maxLength={300}
          placeholder="Kids' birthday party"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
        />
      </label>

      <p className="text-xs text-gray-400">
        {labelHour(startHour)}–{labelHour(startHour + duration)} on {date}
      </p>

      {(error || clientViolation) && (
        <p className="text-sm text-red-600">{error ?? clientViolation}</p>
      )}
      {ok && <p className="text-sm text-green-700">{ok}</p>}

      <button
        onClick={submit}
        disabled={pending || Boolean(clientViolation)}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "Booking…" : "Request booking"}
      </button>
    </div>
  );
}
