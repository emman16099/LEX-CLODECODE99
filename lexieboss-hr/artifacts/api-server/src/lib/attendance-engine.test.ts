import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSummary } from "./attendance-engine";
import type { AttendanceRule } from "@workspace/db";

const rule = {
  id: "standard-8-to-5",
  name: "Standard 8-to-5",
  shiftStart: "08:00",
  shiftEnd: "17:00",
  lateCutoff: "08:00",
  graceMinutes: 5,
  clockOutGraceMinutes: 5,
  breakMinutes: 60,
  lateDeductionMode: "none",
  lateDeductionValue: null,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
} satisfies AttendanceRule;

function phtTime(hour: number, minute: number): Date {
  return new Date(Date.UTC(2026, 7, 30, hour - 8, minute));
}

test("8-to-5 late cutoff honors 8:00, 8:05, and 8:06 exactly", () => {
  const cases = [
    { hour: 8, minute: 0, isLate: false, lateMinutes: 0 },
    { hour: 8, minute: 5, isLate: false, lateMinutes: 0 },
    { hour: 8, minute: 6, isLate: true, lateMinutes: 1 },
  ];

  for (const expected of cases) {
    const summary = computeSummary(
      phtTime(expected.hour, expected.minute),
      phtTime(17, 0),
      rule,
    );

    assert.equal(summary.isLate, expected.isLate, `${expected.hour}:${expected.minute}`);
    assert.equal(summary.lateMinutes, expected.lateMinutes, `${expected.hour}:${expected.minute}`);
    assert.equal(summary.status, expected.isLate ? "late" : "present");
  }
});

test("8-to-5 clock-out boundaries apply the five-minute grace period", () => {
  const cases = [
    { hour: 16, minute: 54, undertimeMinutes: 6 },
    { hour: 16, minute: 55, undertimeMinutes: 0 },
    { hour: 17, minute: 0, undertimeMinutes: 0 },
    { hour: 17, minute: 1, undertimeMinutes: 0 },
  ];

  for (const expected of cases) {
    const summary = computeSummary(
      phtTime(8, 0),
      phtTime(expected.hour, expected.minute),
      rule,
    );

    assert.equal(
      summary.undertimeMinutes,
      expected.undertimeMinutes,
      `${expected.hour}:${String(expected.minute).padStart(2, "0")}`,
    );
  }
});

test("approved overtime stays separate while regular hours remain capped at the shift", () => {
  const summary = computeSummary(phtTime(8, 0), phtTime(18, 30), rule);
  const finalizedOvertime = {
    status: "ot_completed",
    approvedOvertimeHours: "1.50",
  };

  assert.equal(summary.regularHours, "8.00");
  assert.equal(finalizedOvertime.approvedOvertimeHours, "1.50");
  assert.notEqual(summary.regularHours, finalizedOvertime.approvedOvertimeHours);
});

test("a short workday without a shift rule records undertime and its deduction", () => {
  const summary = computeSummary(
    phtTime(8, 0),
    phtTime(14, 26),
    null,
    "800.00",
  );

  assert.equal(summary.regularHours, "6.43");
  assert.equal(summary.undertimeMinutes, 94);
  assert.equal(summary.undertimeDeductionAmount, "156.67");
});

test("a late clock-in without an assigned rule uses the standard cutoff and daily rate", () => {
  const summary = computeSummary(
    phtTime(10, 45),
    phtTime(17, 10),
    null,
    "800.00",
  );

  assert.equal(summary.status, "late");
  assert.equal(summary.lateMinutes, 160);
  assert.equal(summary.lateDeductionAmount, "266.67");
  assert.equal(summary.undertimeMinutes, 0);
});

test("late minutes are not charged again as undertime", () => {
  const summary = computeSummary(
    phtTime(9, 5),
    phtTime(17, 0),
    rule,
    "800.00",
  );

  assert.equal(summary.lateMinutes, 60);
  assert.equal(summary.undertimeMinutes, 0);
});