import { describe, it, expect, vi } from "vitest";

// Mock heavy calendar dependencies — we only test pure helpers
vi.mock("@fullcalendar/core", () => ({ Calendar: class {} }));
vi.mock("@fullcalendar/daygrid", () => ({ default: {} }));
vi.mock("@fullcalendar/timegrid", () => ({ default: {} }));
vi.mock("@fullcalendar/interaction", () => ({ default: {} }));
vi.mock("@fullcalendar/rrule", () => ({ default: {} }));
vi.mock("../../src/main", () => ({ default: class {} }));
vi.mock("../../src/create", () => ({
	sanitizeFilename: (s: string) => s,
	ensureFolder: async () => {},
}));

import { toRRuleString, computeDuration } from "../../src/views/calendar";

describe("toRRuleString", () => {
	it("splits DTSTART prefix format into two lines", () => {
		const result = toRRuleString(
			"DTSTART:20260405;FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=5",
			"2026-04-05",
		);
		expect(result).toBe("DTSTART:20260405\nRRULE:FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=5");
	});

	it("prepends fallback start when no DTSTART in recurrence", () => {
		const result = toRRuleString("FREQ=WEEKLY;BYDAY=MO", "2026-03-27");
		expect(result).toBe("DTSTART:20260327\nRRULE:FREQ=WEEKLY;BYDAY=MO");
	});

	it("strips hyphens from ISO date fallback", () => {
		const result = toRRuleString("FREQ=DAILY", "2026-01-15");
		expect(result).toBe("DTSTART:20260115\nRRULE:FREQ=DAILY");
	});

	it("strips time portion from fallback start", () => {
		const result = toRRuleString("FREQ=DAILY", "2026-01-15T14:30:00+02:00");
		expect(result).toBe("DTSTART:20260115\nRRULE:FREQ=DAILY");
	});

	it("handles DTSTART with time component", () => {
		const result = toRRuleString(
			"DTSTART:20260405T140000Z;FREQ=WEEKLY",
			"2026-04-05",
		);
		expect(result).toBe("DTSTART:20260405T140000Z\nRRULE:FREQ=WEEKLY");
	});
});

describe("computeDuration", () => {
	it("returns HH:MM for valid duration", () => {
		expect(computeDuration(
			"2026-03-27T14:00",
			"2026-03-27T15:30",
		)).toBe("01:30");
	});

	it("returns undefined for zero duration", () => {
		expect(computeDuration(
			"2026-03-27T14:00",
			"2026-03-27T14:00",
		)).toBeUndefined();
	});

	it("returns undefined for negative duration", () => {
		expect(computeDuration(
			"2026-03-27T15:00",
			"2026-03-27T14:00",
		)).toBeUndefined();
	});

	it("returns undefined for invalid dates", () => {
		expect(computeDuration("invalid", "2026-03-27T14:00")).toBeUndefined();
	});

	it("handles multi-hour durations", () => {
		expect(computeDuration(
			"2026-03-27T09:00",
			"2026-03-27T17:45",
		)).toBe("08:45");
	});

	it("handles exact hour durations", () => {
		expect(computeDuration(
			"2026-03-27T10:00",
			"2026-03-27T12:00",
		)).toBe("02:00");
	});
});
