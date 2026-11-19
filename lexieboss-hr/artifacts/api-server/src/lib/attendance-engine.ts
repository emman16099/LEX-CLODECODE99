import { type AttendanceRule } from "@workspace/db";

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

const DEFAULT_LATE_CUTOFF_MINUTES = 8 * 60;
const DEFAULT_GRACE_MINUTES = 5;

function computeDeductionAmount(
  isLate: boolean,
  lateMinutes: number,
  rule: AttendanceRule,
  dailyRateStr: string | null | undefined,
): string {
  if (!isLate || lateMinutes === 0 || rule.lateDeductionMode === "none") {
    return "0.00";
  }

  if (rule.lateDeductionMode === "fixed_amount") {
    return (parseFloat(rule.lateDeductionValue ?? "0")).toFixed(2);
  }

  // per_minute — use explicit rate-per-minute if set, otherwise auto from daily rate
  if (rule.lateDeductionValue) {
    return (parseFloat(rule.lateDeductionValue) * lateMinutes).toFixed(2);
  }

  if (dailyRateStr) {
    const dailyRate = parseFloat(dailyRateStr);
    const shiftStart = parseTimeToMinutes(rule.shiftStart);
    const shiftEnd = parseTimeToMinutes(rule.shiftEnd);
    const grossShiftMinutes = Math.max(shiftEnd - shiftStart, 1);
    const perMinuteRate = dailyRate / grossShiftMinutes;
    return (perMinuteRate * lateMinutes).toFixed(2);
  }

  return "0.00";
}

function getPhtMinutes(dt: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(dt);
  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  return h * 60 + m;
}

function getPhtDateParts(dt: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dt);
  return {
    year: Number(parts.find((p) => p.type === "year")!.value),
    month: Number(parts.find((p) => p.type === "month")!.value),
    day: Number(parts.find((p) => p.type === "day")!.value),
  };
}

function getPhtShiftEndTimestamp(dt: Date, shiftEnd: string): number {
  const { year, month, day } = getPhtDateParts(dt);
  const [hour, minute] = shiftEnd.split(":").map(Number);
  // Asia/Manila is UTC+08:00 and does not observe DST.
  return Date.UTC(year, month - 1, day, hour - 8, minute);
}

export function computeSummary(
  clockInAt: Date | null,
  clockOutAt: Date | null,
  rule: AttendanceRule | null,
  dailyRateStr?: string | null,
): {
  status: "present" | "late" | "absent" | "missing_logout";
  isLate: boolean;
  lateMinutes: number;
  regularHours: string;
  lateDeductionAmount: string;
  undertimeMinutes: number;
  undertimeDeductionAmount: string;
} {
  if (!clockInAt) {
    return {
      status: "absent",
      isLate: false,
      lateMinutes: 0,
      regularHours: "0",
      lateDeductionAmount: "0.00",
      undertimeMinutes: 0,
      undertimeDeductionAmount: "0.00",
    };
  }

  if (!clockOutAt) {
    return {
      status: "missing_logout",
      isLate: false,
      lateMinutes: 0,
      regularHours: "0",
      lateDeductionAmount: "0.00",
      undertimeMinutes: 0,
      undertimeDeductionAmount: "0.00",
    };
  }

  let isLate = false;
  let lateMinutes = 0;

  const clockInMinutes = getPhtMinutes(clockInAt);
  const effectiveCutoff = rule
    ? parseTimeToMinutes(rule.lateCutoff) + (rule.graceMinutes ?? 0)
    : DEFAULT_LATE_CUTOFF_MINUTES + DEFAULT_GRACE_MINUTES;

  if (clockInMinutes > effectiveCutoff) {
    isLate = true;
    // Late minutes start after the allowance: 8:06 is one minute late
    // when the 8:00 cutoff has a five-minute grace period.
    lateMinutes = clockInMinutes - effectiveCutoff;
  }

  // Gross hours worked, then subtract break time
  const breakMinutes = rule?.breakMinutes ?? 0;
  const cappedClockOutMs = rule
    ? Math.min(clockOutAt.getTime(), getPhtShiftEndTimestamp(clockOutAt, rule.shiftEnd))
    : clockOutAt.getTime();
  const grossHoursWorked = (cappedClockOutMs - clockInAt.getTime()) / (1000 * 60 * 60);
  const netHoursWorked = Math.max(0, grossHoursWorked - breakMinutes / 60);
  const regularHours = netHoursWorked.toFixed(2);

  const lateDeductionAmount = rule
    ? computeDeductionAmount(isLate, lateMinutes, rule, dailyRateStr)
    : isLate && dailyRateStr
      ? (
          (parseFloat(dailyRateStr) / (8 * 60)) *
          lateMinutes
        ).toFixed(2)
      : "0.00";

  // Undertime is the unpaid shortfall against the required net workday.
  // Minutes already counted as late are excluded to avoid charging them twice.
  let undertimeMinutes = 0;
  let undertimeDeductionAmount = "0.00";

  const requiredNetMinutes = rule
    ? Math.max(
        0,
        parseTimeToMinutes(rule.shiftEnd) -
          parseTimeToMinutes(rule.shiftStart) -
          (rule.breakMinutes ?? 0),
      )
    : 8 * 60;
  const workedMinutes = Math.round(netHoursWorked * 60);
  const unpaidShortfall = Math.max(
    0,
    requiredNetMinutes - workedMinutes - lateMinutes,
  );

  if (rule) {
    const clockOutMinutes = getPhtMinutes(clockOutAt);
    const shiftEndMinutes = parseTimeToMinutes(rule.shiftEnd);
    const earlyClockOutMinutes = Math.max(0, shiftEndMinutes - clockOutMinutes);
    const clockOutGraceMinutes = rule.clockOutGraceMinutes ?? 0;
    if (earlyClockOutMinutes > clockOutGraceMinutes) {
      undertimeMinutes = Math.max(earlyClockOutMinutes, unpaidShortfall);
    }
  } else {
    undertimeMinutes = unpaidShortfall;
  }

  if (undertimeMinutes > 0 && dailyRateStr) {
    const dailyRate = parseFloat(dailyRateStr);
    const hourlyRate = dailyRate / 8;
    undertimeDeductionAmount = (
      hourlyRate *
      (undertimeMinutes / 60)
    ).toFixed(2);
  }

  return {
    status: isLate ? "late" : "present",
    isLate,
    lateMinutes,
    regularHours,
    lateDeductionAmount,
    undertimeMinutes,
    undertimeDeductionAmount,
  };
}
