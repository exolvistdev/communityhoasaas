import { describe, it, expect } from "vitest";
import { rsvpTally, meetingIsPast, RSVP_LABEL } from "@/lib/meeting";

describe("rsvpTally", () => {
  it("counts by response", () => {
    expect(
      rsvpTally([
        { response: "YES" },
        { response: "YES" },
        { response: "MAYBE" },
        { response: "NO" },
      ])
    ).toEqual({ yes: 2, maybe: 1, no: 1, total: 4 });
  });
  it("is all zeros for no RSVPs", () => {
    expect(rsvpTally([])).toEqual({ yes: 0, maybe: 0, no: 0, total: 0 });
  });
});

describe("meetingIsPast", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  it("true when the scheduled time has passed", () => {
    expect(meetingIsPast({ scheduledAt: new Date("2026-09-10T00:00:00Z") }, now)).toBe(
      true
    );
  });
  it("false for a future meeting", () => {
    expect(meetingIsPast({ scheduledAt: new Date("2026-09-20T00:00:00Z") }, now)).toBe(
      false
    );
  });
});

describe("RSVP_LABEL", () => {
  it("maps each response to a human label", () => {
    expect(RSVP_LABEL.YES).toBe("Going");
    expect(RSVP_LABEL.NO).toBe("Not going");
    expect(RSVP_LABEL.MAYBE).toBe("Maybe");
  });
});
