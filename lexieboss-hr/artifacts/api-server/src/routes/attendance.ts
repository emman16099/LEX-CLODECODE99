import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  attendanceLogsTable,
  attendanceSummariesTable,
  attendanceCorrectionsTable,
  employeesTable,
  appUsersTable,
  attendanceRulesTable,
  payrollPeriodsTable,
  payrollEntriesTable,
  overtimeLogsTable,
  overtimeCorrectionsTable,
} from "@workspace/db";
import { eq, and, gte, lte, desc, isNull, inArray } from "drizzle-orm";
import {
  ClockInBody,
  ClockOutBody,
  ReviewUndertimeBody,
  CorrectAttendanceBody,
  RecordManualAttendanceBody,
} from "@workspace/api-zod";
import { getEmployeeRateForDate } from "../lib/employee-rates";
import { computeSummary } from "../lib/attendance-engine";
import { consumeGateProof } from "../lib/employeeQr";

const router: IRouter = Router();
type AttendanceDatabase = Pick<typeof db, "select" | "update" | "insert" | "delete" | "transaction">;

function todayDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")!.value;
  const month = parts.find((part) => part.type === "month")!.value;
  const day = parts.find((part) => part.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

function getManilaMinutes(timestamp: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(timestamp);
  const hour = Number(parts.find((part) => part.type === "hour")!.value) % 24;
  const minute = Number(parts.find((part) => part.type === "minute")!.value);
  return hour * 60 + minute;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours! * 60 + minutes!;
}

function parseManilaDateTime(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const timestamp = new Date(Date.UTC(year, month - 1, day, hour - 8, minute));

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(timestamp);
  const phtHour = Number(parts.find((part) => part.type === "hour")!.value) % 24;
  const phtMinute = Number(parts.find((part) => part.type === "minute")!.value);
  const phtYear = Number(parts.find((part) => part.type === "year")!.value);
  const phtMonth = Number(parts.find((part) => part.type === "month")!.value);
  const phtDay = Number(parts.find((part) => part.type === "day")!.value);

  return phtYear === year &&
    phtMonth === month &&
    phtDay === day &&
    phtHour === hour &&
    phtMinute === minute
    ? timestamp
    : null;
}

async function getAppUser(replitId: string) {
  const [u] = await db.select().from(appUsersTable).where(eq(appUsersTable.replitId, replitId));
  return u ?? null;
}

function serializeLog(l: typeof attendanceLogsTable.$inferSelect) {
  return {
    id: l.id,
    employeeId: l.employeeId,
    attendanceRuleId: l.attendanceRuleId ?? null,
    date: l.date,
    clockInAt: l.clockInAt ? l.clockInAt.toISOString() : null,
    clockOutAt: l.clockOutAt ? l.clockOutAt.toISOString() : null,
    clockInPhotoUrl: l.clockInPhotoUrl ?? null,
    clockOutPhotoUrl: l.clockOutPhotoUrl ?? null,
    earlyClockOutReason: l.earlyClockOutReason ?? null,
    earlyClockOutNote: l.earlyClockOutNote ?? null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

function serializeCorrection(c: typeof attendanceCorrectionsTable.$inferSelect) {
  return {
    id: c.id,
    attendanceLogId: c.attendanceLogId,
    field: c.field,
    previousValue: c.previousValue ? c.previousValue.toISOString() : null,
    newValue: c.newValue ? c.newValue.toISOString() : null,
    previousAmount: c.previousAmount ?? null,
    newAmount: c.newAmount ?? null,
    reason: c.reason,
    correctedBy: c.correctedBy,
    correctedByName: c.correctedByName,
    createdAt: c.createdAt.toISOString(),
  };
}

function serializeSummary(s: typeof attendanceSummariesTable.$inferSelect) {
  return {
    id: s.id,
    employeeId: s.employeeId,
    attendanceLogId: s.attendanceLogId ?? null,
    date: s.date,
    status: s.status,
    isLate: s.isLate,
    lateMinutes: s.lateMinutes,
    regularHours: s.regularHours,
    dailyRateOverride: s.dailyRateOverride ?? null,
    lateDeductionAmount: s.lateDeductionAmount,
    lateDeductionOverride: s.lateDeductionOverride ?? null,
    undertimeMinutes: s.undertimeMinutes,
    undertimeDeductionAmount: s.undertimeDeductionAmount,
    undertimeStatus: s.undertimeStatus ?? null,
    undertimeReviewNote: s.undertimeReviewNote ?? null,
    undertimeReviewedBy: s.undertimeReviewedBy ?? null,
    undertimeReviewedAt: s.undertimeReviewedAt ? s.undertimeReviewedAt.toISOString() : null,
    computedAt: s.computedAt.toISOString(),
  };
}

function serializeEmployee(e: typeof employeesTable.$inferSelect) {
  return {
    id: e.id,
    employeeCode: e.employeeCode,
    firstName: e.firstName,
    lastName: e.lastName,
    mobileNumber: e.mobileNumber,
    address: e.address,
    hireDate: e.hireDate,
    employmentStatus: e.employmentStatus,
    dailyRate: e.dailyRate,
    sssNumber: e.sssNumber,
    philhealthNumber: e.philhealthNumber,
    pagibigNumber: e.pagibigNumber,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

async function upsertSummaryForLog(
  log: typeof attendanceLogsTable.$inferSelect,
  database: AttendanceDatabase = db,
) {
  let rule: typeof attendanceRulesTable.$inferSelect | null = null;
  if (log.attendanceRuleId) {
    const [r] = await database
      .select()
      .from(attendanceRulesTable)
      .where(eq(attendanceRulesTable.id, log.attendanceRuleId));
    rule = r ?? null;
  }

  const [employee] = await database
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, log.employeeId));
  const configuredDailyRate = employee
    ? getEmployeeRateForDate(employee, log.date)
    : null;

  const existing = await database
    .select()
    .from(attendanceSummariesTable)
    .where(and(
      eq(attendanceSummariesTable.employeeId, log.employeeId),
      eq(attendanceSummariesTable.date, log.date),
    ));
  const dailyRateStr = existing[0]?.dailyRateOverride ?? configuredDailyRate;
  const summary = computeSummary(log.clockInAt, log.clockOutAt, rule, dailyRateStr);
  // Only excused reasons go to pending_review; plain undertime stands immediately (deducted)
  const excusedReasons = ["approved_leave", "official_errand", "approved_exception"];
  const reason = log.earlyClockOutReason ?? null;
  const undertimeStatus =
    summary.undertimeMinutes > 0 && reason && excusedReasons.includes(reason)
      ? "pending_review"
      : null;

  if (existing.length > 0) {
    await database
      .update(attendanceSummariesTable)
      .set({
        status: summary.status,
        isLate: summary.isLate,
        lateMinutes: summary.lateMinutes,
        regularHours: summary.regularHours,
        lateDeductionAmount: existing[0].lateDeductionOverride ?? summary.lateDeductionAmount,
        undertimeMinutes: summary.undertimeMinutes,
        undertimeDeductionAmount: summary.undertimeDeductionAmount,
        undertimeStatus,
        undertimeReviewNote: null,
        undertimeReviewedBy: null,
        undertimeReviewedAt: null,
        computedAt: new Date(),
        attendanceLogId: log.id,
      })
      .where(eq(attendanceSummariesTable.id, existing[0].id));
    const [updated] = await database
      .select()
      .from(attendanceSummariesTable)
      .where(eq(attendanceSummariesTable.id, existing[0].id));
    return updated;
  } else {
    const [inserted] = await database
      .insert(attendanceSummariesTable)
      .values({
        employeeId: log.employeeId,
        attendanceLogId: log.id,
        date: log.date,
        status: summary.status,
        isLate: summary.isLate,
        lateMinutes: summary.lateMinutes,
        regularHours: summary.regularHours,
        lateDeductionAmount: summary.lateDeductionAmount,
        undertimeMinutes: summary.undertimeMinutes,
        undertimeDeductionAmount: summary.undertimeDeductionAmount,
        undertimeStatus: undertimeStatus ?? undefined,
      })
      .returning();
    return inserted;
  }
}

async function getCorrections(
  logId: string,
  database: AttendanceDatabase = db,
) {
  return database
    .select()
    .from(attendanceCorrectionsTable)
    .where(eq(attendanceCorrectionsTable.attendanceLogId, logId))
    .orderBy(desc(attendanceCorrectionsTable.createdAt));
}

type AttendanceCorrectionChange = {
  field: "clock_in" | "clock_out";
  previousValue: Date | null;
  newValue: Date | null;
};

async function invalidatePayrollForAttendanceDate(tx: AttendanceDatabase, date: string) {
  const periods = await tx.select().from(payrollPeriodsTable).where(and(
    lte(payrollPeriodsTable.startDate, date),
    gte(payrollPeriodsTable.endDate, date),
  ));
  if (periods.some((period) => period.status === "paid")) {
    throw new Error("Cannot edit attendance inside a paid payroll period");
  }
  // Claim periods before touching source records so generation and correction
  // serialize on the same row. Reopening an approved period revokes approval.
  for (const period of periods.sort((a, b) => a.id.localeCompare(b.id))) {
    const claimed = await tx.update(payrollPeriodsTable).set({
      status: "draft",
      generatedAt: null,
      approvedAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(payrollPeriodsTable.id, period.id),
      inArray(payrollPeriodsTable.status, ["draft", "approved"]),
    )).returning();
    if (claimed.length !== 1) {
      throw new Error("Payroll period changed while applying the correction; refresh and try again");
    }
    await tx.delete(payrollEntriesTable).where(eq(payrollEntriesTable.payrollPeriodId, period.id));
  }
}

export async function applyAttendanceCorrection(
  id: string,
  patch: {
    clockInAt?: Date | null;
    clockOutAt?: Date | null;
    overtimeHours?: number;
    dailyRate?: number;
    lateDeduction?: number;
    reason: string;
  },
  changes: AttendanceCorrectionChange[],
  correctedBy: string,
  correctedByName: string,
  database: AttendanceDatabase = db,
) {
  const reason = patch.reason.trim();
  if (!reason) {
    throw new Error("A meaningful correction reason is required");
  }

  return database.transaction(async (tx) => {
    const [currentLog] = await tx.select().from(attendanceLogsTable).where(eq(attendanceLogsTable.id, id));
    if (!currentLog) throw new Error("Attendance record no longer exists");
    await invalidatePayrollForAttendanceDate(tx, currentLog.date);
    const expectedTimestampConditions = changes.map((change) => {
      const column = change.field === "clock_in"
        ? attendanceLogsTable.clockInAt
        : attendanceLogsTable.clockOutAt;
      return change.previousValue === null
        ? isNull(column)
        : eq(column, change.previousValue);
    });
    const [updated] = await tx
      .update(attendanceLogsTable)
      .set({
        ...(patch.clockInAt !== undefined ? { clockInAt: patch.clockInAt } : {}),
        ...(patch.clockOutAt !== undefined ? { clockOutAt: patch.clockOutAt } : {}),
        updatedAt: new Date(),
      })
      .where(and(
        eq(attendanceLogsTable.id, id),
        ...expectedTimestampConditions,
      ))
      .returning();

    if (!updated) {
      throw new Error("Attendance timestamps changed while applying the correction; refresh and try again");
    }
    const [originalSummary] = await tx
      .select()
      .from(attendanceSummariesTable)
      .where(and(
        eq(attendanceSummariesTable.employeeId, updated.employeeId),
        eq(attendanceSummariesTable.date, updated.date),
      ));
    const previousDailyRateOverride = originalSummary?.dailyRateOverride ?? null;
    const previousLateDeduction = originalSummary?.lateDeductionAmount ?? "0.00";
    const [rateEmployee] = patch.dailyRate !== undefined
      ? await tx
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.id, updated.employeeId))
      : [];
    const previousEffectiveDailyRate = previousDailyRateOverride
      ?? (rateEmployee ? getEmployeeRateForDate(rateEmployee, updated.date) : null);

    if (changes.length > 0) {
      await tx.insert(attendanceCorrectionsTable).values(
        changes.map((change) => ({
          attendanceLogId: id,
          field: change.field,
          previousValue: change.previousValue,
          newValue: change.newValue,
          reason,
          correctedBy,
          correctedByName,
        })),
      );
    }

    if (patch.overtimeHours !== undefined) {
      const finalizedOvertime = await tx
        .select()
        .from(overtimeLogsTable)
        .where(and(
          eq(overtimeLogsTable.employeeId, updated.employeeId),
          eq(overtimeLogsTable.periodDate, updated.date),
          eq(overtimeLogsTable.status, "ot_completed"),
        ));
      if (finalizedOvertime.length > 1) {
        throw new Error("Multiple finalized overtime records exist for this date; correct them individually from Overtime");
      }
      const correctedHours = patch.overtimeHours.toFixed(2);

      if (finalizedOvertime.length === 0) {
        if (patch.overtimeHours <= 0) {
          throw new Error("Manual overtime hours must be greater than zero");
        }
        const now = new Date();
        const [createdOvertime] = await tx
          .insert(overtimeLogsTable)
          .values({
            employeeId: updated.employeeId,
            periodDate: updated.date,
            attendanceLogId: updated.id,
            otReason: reason,
            assignmentSource: "manual_correction",
            status: "ot_completed",
            approvedBy: correctedBy,
            approvedByName: correctedByName,
            approvalTimestamp: now,
            approvedOvertimeHours: correctedHours,
            adminNotes: reason,
            updatedAt: now,
          })
          .returning();
        if (!createdOvertime) {
          throw new Error("Unable to create manual overtime for this attendance date");
        }
        await tx.insert(overtimeCorrectionsTable).values({
          overtimeLogId: createdOvertime.id,
          action: "manual_add_approved_hours",
          originalApprovedHours: null,
          correctedApprovedHours: correctedHours,
          reason,
          adminId: correctedBy,
          adminName: correctedByName,
        });
      } else {
        const overtime = finalizedOvertime[0]!;
        const originalApprovedHours = overtime.approvedOvertimeHours;
        const currentHoursCondition = overtime.approvedOvertimeHours === null
          ? isNull(overtimeLogsTable.approvedOvertimeHours)
          : eq(overtimeLogsTable.approvedOvertimeHours, overtime.approvedOvertimeHours);
        const updatedOvertime = await tx
          .update(overtimeLogsTable)
          .set({
            approvedOvertimeHours: correctedHours,
            adminNotes: reason,
            updatedAt: new Date(),
          })
          .where(and(
            eq(overtimeLogsTable.id, overtime.id),
            eq(overtimeLogsTable.status, "ot_completed"),
            currentHoursCondition,
          ))
          .returning();
        if (updatedOvertime.length !== 1) {
          throw new Error("Overtime changed while applying the correction; refresh and try again");
        }
        await tx.insert(overtimeCorrectionsTable).values({
          overtimeLogId: overtime.id,
          action: "correct_approved_hours",
          originalOtInTime: overtime.otInTime,
          originalOtOutTime: overtime.otOutTime,
          correctedOtInTime: overtime.otInTime,
          correctedOtOutTime: overtime.otOutTime,
          originalApprovedHours,
          correctedApprovedHours: correctedHours,
          reason,
          adminId: correctedBy,
          adminName: correctedByName,
        });
      }
    }

    let summary = await upsertSummaryForLog(updated, tx);
    if (patch.dailyRate !== undefined || patch.lateDeduction !== undefined) {
      const dailyRateOverride = patch.dailyRate !== undefined
        ? patch.dailyRate.toFixed(2)
        : summary.dailyRateOverride;
      const ruleRows = updated.attendanceRuleId
        ? await tx
          .select()
          .from(attendanceRulesTable)
          .where(eq(attendanceRulesTable.id, updated.attendanceRuleId))
        : [];
      const recalculated = computeSummary(
        updated.clockInAt,
        updated.clockOutAt,
        ruleRows[0] ?? null,
        dailyRateOverride ?? undefined,
      );
      const [overridden] = await tx
        .update(attendanceSummariesTable)
        .set({
          dailyRateOverride,
          lateDeductionOverride: patch.lateDeduction !== undefined
            ? patch.lateDeduction.toFixed(2)
            : summary.lateDeductionOverride,
          lateDeductionAmount: patch.lateDeduction !== undefined
            ? patch.lateDeduction.toFixed(2)
            : recalculated.lateDeductionAmount,
          undertimeDeductionAmount: recalculated.undertimeDeductionAmount,
          computedAt: new Date(),
        })
        .where(eq(attendanceSummariesTable.id, summary.id))
        .returning();
      summary = overridden;
    }
    const financialCorrections = [
      ...(patch.dailyRate !== undefined ? [{
        attendanceLogId: id,
        field: "daily_rate" as const,
        previousAmount: previousEffectiveDailyRate,
        newAmount: patch.dailyRate.toFixed(2),
        reason,
        correctedBy,
        correctedByName,
      }] : []),
      ...(patch.lateDeduction !== undefined ? [{
        attendanceLogId: id,
        field: "late_deduction" as const,
        previousAmount: previousLateDeduction,
        newAmount: patch.lateDeduction.toFixed(2),
        reason,
        correctedBy,
        correctedByName,
      }] : []),
    ];
    if (financialCorrections.length > 0) {
      await tx.insert(attendanceCorrectionsTable).values(financialCorrections);
    }
    const corrections = await getCorrections(id, tx);
    return { updated, summary, corrections };
  });
}

export class ManualAttendanceError extends Error {}

type ManualAttendanceAction = "clock_in" | "clock_out";

export async function recordManualAttendance(
  input: {
    employeeId: string;
    date: string;
    action: ManualAttendanceAction;
    timestamp: Date;
    attendanceRuleId?: string | null;
    reason: string;
    correctedBy: string;
    correctedByName: string;
  },
  database: AttendanceDatabase = db,
) {
  return database.transaction(async (tx) => {
    await invalidatePayrollForAttendanceDate(tx, input.date);
    const [existing] = await tx
      .select()
      .from(attendanceLogsTable)
      .where(and(
        eq(attendanceLogsTable.employeeId, input.employeeId),
        eq(attendanceLogsTable.date, input.date),
      ));

    let log: typeof attendanceLogsTable.$inferSelect;
    let previousValue: Date | null;

    if (input.action === "clock_in") {
      if (existing?.clockInAt) {
        throw new ManualAttendanceError("Employee is already clocked in for this date");
      }
      if (existing?.clockOutAt && input.timestamp.getTime() > existing.clockOutAt.getTime()) {
        throw new ManualAttendanceError("Clock-in cannot be later than the existing clock-out");
      }

      previousValue = existing?.clockInAt ?? null;
      if (existing) {
        const [updated] = await tx
          .update(attendanceLogsTable)
          .set({
            clockInAt: input.timestamp,
            clockInPhotoUrl: null,
            attendanceRuleId: existing.attendanceRuleId ?? input.attendanceRuleId ?? undefined,
            updatedAt: new Date(),
          })
          .where(and(
            eq(attendanceLogsTable.id, existing.id),
            isNull(attendanceLogsTable.clockInAt),
          ))
          .returning();
        if (!updated) {
          throw new ManualAttendanceError("Employee is already clocked in for this date");
        }
        log = updated;
      } else {
        const insertedRows = await tx
          .insert(attendanceLogsTable)
          .values({
            employeeId: input.employeeId,
            attendanceRuleId: input.attendanceRuleId ?? undefined,
            date: input.date,
            clockInAt: input.timestamp,
            clockInPhotoUrl: null,
          })
          .onConflictDoNothing()
          .returning();
        if (insertedRows.length !== 1) {
          throw new ManualAttendanceError("An attendance record already exists for this date");
        }
        log = insertedRows[0];
      }
    } else {
      if (!existing?.clockInAt) {
        throw new ManualAttendanceError("Clock-in is required before recording a clock-out");
      }
      if (existing.clockOutAt) {
        throw new ManualAttendanceError("Employee is already clocked out for this date");
      }
      if (input.timestamp.getTime() < existing.clockInAt.getTime()) {
        throw new ManualAttendanceError("Clock-out cannot be earlier than clock-in");
      }

      previousValue = null;
      const [updated] = await tx
        .update(attendanceLogsTable)
        .set({
          clockOutAt: input.timestamp,
          clockOutPhotoUrl: null,
          updatedAt: new Date(),
        })
        .where(and(
          eq(attendanceLogsTable.id, existing.id),
          isNull(attendanceLogsTable.clockOutAt),
        ))
        .returning();
      if (!updated) {
        throw new ManualAttendanceError("Employee is already clocked out for this date");
      }
      log = updated;
    }

    await tx.insert(attendanceCorrectionsTable).values({
      attendanceLogId: log.id,
      field: input.action,
      previousValue,
      newValue: input.timestamp,
      reason: input.reason,
      correctedBy: input.correctedBy,
      correctedByName: input.correctedByName,
    });

    const summary = await upsertSummaryForLog(log, tx);
    const corrections = await getCorrections(log.id, tx);
    return { updated: log, summary, corrections };
  });
}

export async function recordGateClockIn(
  input: {
    employeeId: string;
    attendanceRuleId?: string | null;
  },
  database: AttendanceDatabase = db,
  now = new Date(),
) {
  const today = todayDate(now);
  const [activeEmployee] = await database
    .select({ id: employeesTable.id })
    .from(employeesTable)
    .where(and(
      eq(employeesTable.id, input.employeeId),
      eq(employeesTable.employmentStatus, "active"),
    ));
  if (!activeEmployee) {
    throw new Error("Employee attendance access is not active");
  }

  const approvedAssignments = await database
    .select()
    .from(overtimeLogsTable)
    .where(
      and(
        eq(overtimeLogsTable.employeeId, input.employeeId),
        eq(overtimeLogsTable.periodDate, today),
        eq(overtimeLogsTable.status, "ot_approved"),
        eq(overtimeLogsTable.assignmentSource, "admin_assignment"),
      ),
    );
  const nowMinutes = getManilaMinutes(now);
  const currentAssignment = approvedAssignments.find(
    (assignment) =>
      assignment.plannedStartTime &&
      assignment.plannedEndTime &&
      nowMinutes >= timeToMinutes(assignment.plannedStartTime) &&
      nowMinutes < timeToMinutes(assignment.plannedEndTime),
  );
  const activeRules = await database
    .select()
    .from(attendanceRulesTable)
    .where(eq(attendanceRulesTable.isActive, true));
  const assignmentMatchedRule = currentAssignment?.plannedEndTime
    ? activeRules.find(
        (rule) => rule.shiftStart === currentAssignment.plannedEndTime,
      )
    : undefined;
  const selectedRule = input.attendanceRuleId
    ? activeRules.find((rule) => rule.id === input.attendanceRuleId)
    : undefined;
  if (input.attendanceRuleId && !selectedRule && !assignmentMatchedRule) {
    throw new Error("Selected attendance rule is not active");
  }
  if (!assignmentMatchedRule && !selectedRule && activeRules.length > 1) {
    throw new Error("Select the attendance rule for this shift before clocking in");
  }
  const attendanceRule =
    assignmentMatchedRule ??
    selectedRule ??
    (activeRules.length === 1 ? activeRules[0]! : null);
  const attendanceRuleId = attendanceRule?.id ?? null;
  const earlyAssignment = assignmentMatchedRule ? currentAssignment : undefined;
  const regularClockInAt = earlyAssignment?.plannedEndTime
    ? parseManilaDateTime(today, earlyAssignment.plannedEndTime) ?? now
    : now;

  return database.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(attendanceLogsTable)
      .where(
        and(
          eq(attendanceLogsTable.employeeId, input.employeeId),
          eq(attendanceLogsTable.date, today),
        ),
      );
    if (existing[0]?.clockInAt) {
      throw new Error("Already clocked in today");
    }

    if (earlyAssignment) {
      const claimedAssignments = await tx
        .update(overtimeLogsTable)
        .set({
          status: "ot_in_progress",
          otInTime: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(overtimeLogsTable.id, earlyAssignment.id),
            eq(overtimeLogsTable.status, "ot_approved"),
          ),
        )
        .returning();
      if (claimedAssignments.length !== 1) {
        throw new Error(
          "Early overtime is no longer approved. Refresh and scan again.",
        );
      }
    }

    if (existing.length > 0) {
      const updatedRows = await tx
        .update(attendanceLogsTable)
        .set({
          clockInAt: regularClockInAt,
          clockInPhotoUrl: null,
          attendanceRuleId: attendanceRuleId ?? undefined,
        })
        .where(
          and(
            eq(attendanceLogsTable.id, existing[0].id),
            isNull(attendanceLogsTable.clockInAt),
          ),
        )
        .returning();
      if (updatedRows.length !== 1) {
        throw new Error("Already clocked in today");
      }
      return updatedRows[0]!;
    }

    const insertedRows = await tx
      .insert(attendanceLogsTable)
      .values({
        employeeId: input.employeeId,
        attendanceRuleId: attendanceRuleId ?? undefined,
        date: today,
        clockInAt: regularClockInAt,
        clockInPhotoUrl: null,
      })
      .onConflictDoNothing()
      .returning();
    if (insertedRows.length !== 1) {
      throw new Error("Already clocked in today");
    }
    return insertedRows[0]!;
  });
}

// POST /api/attendance/manual (admin)
router.post("/attendance/manual", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const appUser = await getAppUser(req.user!.id);
  if (!appUser || appUser.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const parsed = RecordManualAttendanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const timestamp = parseManilaDateTime(parsed.data.date, parsed.data.time);
  if (!timestamp) {
    res.status(400).json({ error: "Date or time is invalid" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(and(
      eq(employeesTable.id, parsed.data.employeeId),
      eq(employeesTable.employmentStatus, "active"),
    ));
  if (!employee) {
    res.status(400).json({ error: "Active employee not found" });
    return;
  }

  const [paidPeriod] = await db
    .select({ id: payrollPeriodsTable.id })
    .from(payrollPeriodsTable)
    .where(and(
      eq(payrollPeriodsTable.status, "paid"),
      lte(payrollPeriodsTable.startDate, parsed.data.date),
      gte(payrollPeriodsTable.endDate, parsed.data.date),
    ));
  if (paidPeriod) {
    res.status(400).json({ error: "Cannot add manual attendance inside a payroll period that has been marked paid" });
    return;
  }

  let attendanceRuleId = parsed.data.attendanceRuleId ?? null;
  if (attendanceRuleId && parsed.data.action === "clock_in") {
    const [rule] = await db
      .select({ id: attendanceRulesTable.id })
      .from(attendanceRulesTable)
      .where(and(
        eq(attendanceRulesTable.id, attendanceRuleId),
        eq(attendanceRulesTable.isActive, true),
      ));
    if (!rule) {
      res.status(400).json({ error: "Attendance rule not found or inactive" });
      return;
    }
  }

  if (parsed.data.action === "clock_out") {
    attendanceRuleId = null;
  } else if (!attendanceRuleId) {
    const [activeRule] = await db
      .select({ id: attendanceRulesTable.id })
      .from(attendanceRulesTable)
      .where(eq(attendanceRulesTable.isActive, true));
    attendanceRuleId = activeRule?.id ?? null;
  }

  const correctedByName =
    `${req.user!.firstName ?? ""} ${req.user!.lastName ?? ""}`.trim() ||
    req.user!.email ||
    req.user!.id;

  try {
    const result = await recordManualAttendance({
      employeeId: employee.id,
      date: parsed.data.date,
      action: parsed.data.action,
      timestamp,
      attendanceRuleId,
      reason: parsed.data.reason.trim(),
      correctedBy: req.user!.id,
      correctedByName,
    });

    res.status(200).json({
      log: serializeLog(result.updated),
      summary: serializeSummary(result.summary),
      corrections: result.corrections.map(serializeCorrection),
    });
  } catch (error) {
    if (error instanceof ManualAttendanceError || (error instanceof Error && error.message.includes("paid payroll period"))) {
      res.status(400).json({ error: error.message });
      return;
    }
    throw error;
  }
});

// POST /api/attendance/clock-in
router.post("/attendance/clock-in", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const appUser = await getAppUser(req.user!.id);
  if (!appUser?.employeeId) {
    res.status(400).json({ error: "No employee linked to this account" });
    return;
  }

  const parsed = ClockInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await consumeGateProof(parsed.data.gateProof))) {
    res.status(401).json({ error: "Gate verification expired or was already used. Scan the gate QR again." });
    return;
  }

  let log: typeof attendanceLogsTable.$inferSelect;
  try {
    log = await recordGateClockIn({
      employeeId: appUser.employeeId,
      attendanceRuleId: parsed.data.attendanceRuleId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Employee attendance access is not active") {
      res.status(403).json({ error: error.message });
      return;
    }
    res.status(409).json({
      error: error instanceof Error ? error.message : "Unable to clock in",
    });
    return;
  }

  await upsertSummaryForLog(log);
  res.status(201).json(serializeLog(log));
});

// POST /api/attendance/clock-out
router.post("/attendance/clock-out", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const appUser = await getAppUser(req.user!.id);
  if (!appUser?.employeeId) {
    res.status(400).json({ error: "No employee linked to this account" });
    return;
  }

  const parsed = ClockOutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await consumeGateProof(parsed.data.gateProof))) {
    res.status(401).json({ error: "Gate verification expired or was already used. Scan the gate QR again." });
    return;
  }

  const today = todayDate();
  const [activeEmployee] = await db
    .select({ id: employeesTable.id })
    .from(employeesTable)
    .where(and(
      eq(employeesTable.id, appUser.employeeId),
      eq(employeesTable.employmentStatus, "active"),
    ));
  if (!activeEmployee) {
    res.status(403).json({ error: "Employee attendance access is not active" });
    return;
  }
  const [log] = await db
    .select()
    .from(attendanceLogsTable)
    .where(and(
      eq(attendanceLogsTable.employeeId, appUser.employeeId),
      eq(attendanceLogsTable.date, today),
    ));

  if (!log || !log.clockInAt) {
    res.status(400).json({ error: "Not clocked in today" });
    return;
  }

  if (log.clockOutAt) {
    res.status(400).json({ error: "Already clocked out today" });
    return;
  }

  const updatedRows = await db
    .update(attendanceLogsTable)
    .set({
      clockOutAt: new Date(),
      clockOutPhotoUrl: null,
      earlyClockOutReason: parsed.data.earlyClockOutReason ?? undefined,
      earlyClockOutNote: parsed.data.earlyClockOutNote ?? undefined,
    })
    .where(and(
      eq(attendanceLogsTable.id, log.id),
      isNull(attendanceLogsTable.clockOutAt),
    ))
    .returning();
  if (updatedRows.length !== 1) {
    res.status(400).json({ error: "Already clocked out today" });
    return;
  }
  const updated = updatedRows[0];

  await upsertSummaryForLog(updated);
  res.json(serializeLog(updated));
});

// PATCH /api/attendance/logs/:id/correct (admin)
router.patch("/attendance/logs/:id/correct", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const appUser = await getAppUser(req.user!.id);
  if (!appUser || appUser.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const parsed = CorrectAttendanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!parsed.data.reason.trim()) {
    res.status(400).json({ error: "A meaningful correction reason is required" });
    return;
  }

  const id = String(req.params.id);
  const [log] = await db
    .select()
    .from(attendanceLogsTable)
    .where(eq(attendanceLogsTable.id, id));

  if (!log) {
    res.status(404).json({ error: "Attendance log not found" });
    return;
  }

  const payrollPeriods = await db
    .select()
    .from(payrollPeriodsTable)
    .where(and(
      lte(payrollPeriodsTable.startDate, log.date),
      gte(payrollPeriodsTable.endDate, log.date),
    ));
  if (payrollPeriods.some((period) => period.status === "paid")) {
    res.status(400).json({ error: "Cannot correct attendance or overtime inside a paid payroll period" });
    return;
  }

  const changes: Array<{
    field: "clock_in" | "clock_out";
    previousValue: Date | null;
    newValue: Date | null;
  }> = [];
  if (parsed.data.clockInAt !== undefined && parsed.data.clockInAt?.getTime() !== log.clockInAt?.getTime()) {
    changes.push({
      field: "clock_in",
      previousValue: log.clockInAt,
      newValue: parsed.data.clockInAt ?? null,
    });
  }
  if (parsed.data.clockOutAt !== undefined && parsed.data.clockOutAt?.getTime() !== log.clockOutAt?.getTime()) {
    changes.push({
      field: "clock_out",
      previousValue: log.clockOutAt,
      newValue: parsed.data.clockOutAt ?? null,
    });
  }

  let overtimeChanged = false;
  if (parsed.data.overtimeHours !== undefined) {
    const finalizedOvertime = await db
      .select()
      .from(overtimeLogsTable)
      .where(and(
        eq(overtimeLogsTable.employeeId, log.employeeId),
        eq(overtimeLogsTable.periodDate, log.date),
        eq(overtimeLogsTable.status, "ot_completed"),
      ));
    if (finalizedOvertime.length === 0) {
      if (parsed.data.overtimeHours <= 0) {
        res.status(400).json({ error: "Manual overtime hours must be greater than zero" });
        return;
      }
      overtimeChanged = true;
    }
    if (finalizedOvertime.length > 1) {
      res.status(400).json({ error: "Multiple finalized overtime records exist for this date; correct them individually from Overtime" });
      return;
    }
    if (finalizedOvertime.length === 1) {
      overtimeChanged = Number(finalizedOvertime[0]!.approvedOvertimeHours ?? 0).toFixed(2) !== parsed.data.overtimeHours.toFixed(2);
    }
  }

  const [employee, currentSummary] = await Promise.all([
    db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, log.employeeId))
      .then((rows) => rows[0]),
    db
      .select()
      .from(attendanceSummariesTable)
      .where(and(
        eq(attendanceSummariesTable.employeeId, log.employeeId),
        eq(attendanceSummariesTable.date, log.date),
      ))
      .then((rows) => rows[0]),
  ]);
  const currentDailyRate = employee
    ? currentSummary?.dailyRateOverride ?? getEmployeeRateForDate(employee, log.date)
    : null;
  const dailyRateChanged = parsed.data.dailyRate !== undefined
    && parsed.data.dailyRate.toFixed(2) !== Number(currentDailyRate ?? 0).toFixed(2);
  const lateDeductionChanged = parsed.data.lateDeduction !== undefined
    && parsed.data.lateDeduction.toFixed(2) !== Number(currentSummary?.lateDeductionAmount ?? 0).toFixed(2);

  if (changes.length === 0 && !overtimeChanged && !dailyRateChanged && !lateDeductionChanged) {
    res.status(400).json({ error: "Change a timestamp, daily rate, late deduction, or approved overtime hours before saving" });
    return;
  }

  const nextClockIn = parsed.data.clockInAt !== undefined ? parsed.data.clockInAt : log.clockInAt;
  const nextClockOut = parsed.data.clockOutAt !== undefined ? parsed.data.clockOutAt : log.clockOutAt;
  if (nextClockIn && nextClockOut && nextClockOut.getTime() < nextClockIn.getTime()) {
    res.status(400).json({ error: "Clock-out cannot be earlier than clock-in" });
    return;
  }

  const correctedByName =
    `${req.user!.firstName ?? ""} ${req.user!.lastName ?? ""}`.trim() ||
    req.user!.email ||
    req.user!.id;

  let result: Awaited<ReturnType<typeof applyAttendanceCorrection>>;
  try {
    const correctionPatch = { ...parsed.data, reason: parsed.data.reason.trim() };
    if (!overtimeChanged) delete correctionPatch.overtimeHours;
    if (!dailyRateChanged) delete correctionPatch.dailyRate;
    if (!lateDeductionChanged) delete correctionPatch.lateDeduction;
    result = await applyAttendanceCorrection(
      id,
      correctionPatch,
      changes,
      req.user!.id,
      correctedByName,
    );
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes("changed while") ||
      error.message.includes("paid payroll period")
    )) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }

  res.json({
    log: serializeLog(result.updated),
    summary: serializeSummary(result.summary),
    corrections: result.corrections.map(serializeCorrection),
  });
});

// GET /api/attendance/today
router.get("/attendance/today", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const appUser = await getAppUser(req.user!.id);
  if (!appUser?.employeeId) {
    res.json({ log: null, summary: null });
    return;
  }

  const today = todayDate();

  const [log] = await db
    .select()
    .from(attendanceLogsTable)
    .where(and(
      eq(attendanceLogsTable.employeeId, appUser.employeeId),
      eq(attendanceLogsTable.date, today),
    ));

  if (!log) {
    res.json({ log: null, summary: null });
    return;
  }

  const [summary] = await db
    .select()
    .from(attendanceSummariesTable)
    .where(and(
      eq(attendanceSummariesTable.employeeId, appUser.employeeId),
      eq(attendanceSummariesTable.date, today),
    ));

  res.json({
    log: serializeLog(log),
    summary: summary ? serializeSummary(summary) : null,
  });
});

// GET /api/attendance/logs (admin)
router.get("/attendance/logs", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const appUser = await getAppUser(req.user!.id);
  if (!appUser || appUser.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { from, to, employeeId, status } = req.query as {
    from?: string;
    to?: string;
    employeeId?: string;
    status?: string;
  };

  const conditions = [];
  if (from) conditions.push(gte(attendanceLogsTable.date, from));
  if (to) conditions.push(lte(attendanceLogsTable.date, to));
  if (employeeId) conditions.push(eq(attendanceLogsTable.employeeId, employeeId));

  const logs = conditions.length
    ? await db.select().from(attendanceLogsTable).where(and(...conditions)).orderBy(desc(attendanceLogsTable.date))
    : await db.select().from(attendanceLogsTable).orderBy(desc(attendanceLogsTable.date));

  const employeeIds = [...new Set(logs.map((log) => log.employeeId))];
  const dates = [...new Set(logs.map((log) => log.date))];
  const completedOvertime = employeeIds.length && dates.length
    ? await db
      .select()
      .from(overtimeLogsTable)
      .where(and(
        inArray(overtimeLogsTable.employeeId, employeeIds),
        inArray(overtimeLogsTable.periodDate, dates),
        eq(overtimeLogsTable.status, "ot_completed"),
      ))
    : [];
  const overtimeHoursByEmployeeDate = new Map<string, number>();
  for (const overtime of completedOvertime) {
    const hours = Number(overtime.approvedOvertimeHours ?? 0);
    if (!Number.isFinite(hours) || hours <= 0) continue;
    const key = `${overtime.employeeId}:${overtime.periodDate}`;
    overtimeHoursByEmployeeDate.set(
      key,
      (overtimeHoursByEmployeeDate.get(key) ?? 0) + hours,
    );
  }

  const results = await Promise.all(
    logs.map(async (log) => {
      const [summary] = await db
        .select()
        .from(attendanceSummariesTable)
        .where(and(
          eq(attendanceSummariesTable.employeeId, log.employeeId),
          eq(attendanceSummariesTable.date, log.date),
        ));

      const [employee] = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.id, log.employeeId));

      return {
        log: serializeLog(log),
        summary: summary ? serializeSummary(summary) : null,
        overtimeHours: overtimeHoursByEmployeeDate.get(`${log.employeeId}:${log.date}`)?.toFixed(2) ?? null,
        applicableDailyRate: employee
          ? (summary?.dailyRateOverride ?? getEmployeeRateForDate(employee, log.date))
          : null,
        employee: employee ? serializeEmployee(employee) : null,
        corrections: (await getCorrections(log.id)).map(serializeCorrection),
      };
    }),
  );

  const filtered = status
    ? results.filter((r) => r.summary?.status === status)
    : results;

  res.json(filtered);
});

// GET /api/attendance/undertime-pending (admin)
router.get("/attendance/undertime-pending", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const appUser = await getAppUser(req.user!.id);
  if (!appUser || appUser.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const pending = await db
    .select()
    .from(attendanceSummariesTable)
    .where(eq(attendanceSummariesTable.undertimeStatus, "pending_review"))
    .orderBy(desc(attendanceSummariesTable.date));

  const results = await Promise.all(
    pending.map(async (summary) => {
      const log = summary.attendanceLogId
        ? await db.select().from(attendanceLogsTable).where(eq(attendanceLogsTable.id, summary.attendanceLogId)).then((r) => r[0] ?? null)
        : null;

      const [employee] = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.id, summary.employeeId));

      return {
        log: log ? serializeLog(log) : null,
        summary: serializeSummary(summary),
        employee: employee ? serializeEmployee(employee) : null,
      };
    }),
  );

  res.json(results);
});

// PATCH /api/attendance/summaries/:id/review-undertime (admin) — must be before /summaries
router.patch("/attendance/summaries/:id/review-undertime", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const appUser = await getAppUser(req.user!.id);
  if (!appUser || appUser.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const id = String(req.params.id);
  const parsed = ReviewUndertimeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(attendanceSummariesTable)
    .where(eq(attendanceSummariesTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Attendance summary not found" });
    return;
  }

  if (existing.undertimeMinutes === 0) {
    res.status(400).json({ error: "This summary has no undertime to review" });
    return;
  }

  if (existing.undertimeStatus !== "pending_review") {
    res.status(400).json({ error: "Only pending_review records can be reviewed" });
    return;
  }

  // approved = excuse accepted → zero the deduction (waive)
  // rejected = excuse rejected → keep original deduction amount
  const [updated] = await db
    .update(attendanceSummariesTable)
    .set({
      undertimeStatus: parsed.data.decision,
      undertimeDeductionAmount: parsed.data.decision === "approved" ? "0.00" : existing.undertimeDeductionAmount,
      undertimeReviewNote: parsed.data.reviewNote ?? null,
      undertimeReviewedBy: req.user!.id,
      undertimeReviewedAt: new Date(),
    })
    .where(eq(attendanceSummariesTable.id, id))
    .returning();

  res.json(serializeSummary(updated));
});

// GET /api/attendance/summaries/today (admin dashboard)
router.get("/attendance/summaries/today", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const appUser = await getAppUser(req.user!.id);
  if (!appUser || appUser.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const today = todayDate();

  const totalEmployees = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.employmentStatus, "active"));

  const summaries = await db
    .select()
    .from(attendanceSummariesTable)
    .where(eq(attendanceSummariesTable.date, today));

  const presentCount = summaries.filter((s) => s.status === "present").length;
  const lateCount = summaries.filter((s) => s.status === "late").length;
  const missingLogoutCount = summaries.filter((s) => s.status === "missing_logout").length;
  const absentCount = Math.max(0, totalEmployees.length - presentCount - lateCount - missingLogoutCount);

  const undertimePendingCount = await db
    .select()
    .from(attendanceSummariesTable)
    .where(eq(attendanceSummariesTable.undertimeStatus, "pending_review"))
    .then((r) => r.length);

  const lateLogIds = summaries
    .filter((s) => s.status === "late" && s.attendanceLogId)
    .map((s) => s.attendanceLogId!);

  const missingLogoutLogIds = summaries
    .filter((s) => s.status === "missing_logout" && s.attendanceLogId)
    .map((s) => s.attendanceLogId!);

  async function buildLogWithSummaryAndEmployee(logIds: string[]) {
    return Promise.all(
      logIds.map(async (logId) => {
        const [log] = await db.select().from(attendanceLogsTable).where(eq(attendanceLogsTable.id, logId));
        if (!log) return null;
        const [summary] = await db.select().from(attendanceSummariesTable).where(and(
          eq(attendanceSummariesTable.employeeId, log.employeeId),
          eq(attendanceSummariesTable.date, today),
        ));
        const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, log.employeeId));
        return {
          log: serializeLog(log),
          summary: summary ? serializeSummary(summary) : null,
          employee: employee ? serializeEmployee(employee) : null,
        };
      }),
    ).then((r) => r.filter(Boolean));
  }

  const lateEmployees = await buildLogWithSummaryAndEmployee(lateLogIds);
  const missingLogoutEmployees = await buildLogWithSummaryAndEmployee(missingLogoutLogIds);

  res.json({
    date: today,
    totalEmployees: totalEmployees.length,
    presentCount,
    lateCount,
    absentCount,
    missingLogoutCount,
    undertimePendingCount,
    lateEmployees,
    missingLogoutEmployees,
  });
});

// GET /api/attendance/summaries (admin)
router.get("/attendance/summaries", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const appUser = await getAppUser(req.user!.id);
  if (!appUser || appUser.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { employeeId, from, to } = req.query as {
    employeeId?: string;
    from?: string;
    to?: string;
  };

  const conditions = [];
  if (employeeId) conditions.push(eq(attendanceSummariesTable.employeeId, employeeId));
  if (from) conditions.push(gte(attendanceSummariesTable.date, from));
  if (to) conditions.push(lte(attendanceSummariesTable.date, to));

  const summaries = conditions.length
    ? await db.select().from(attendanceSummariesTable).where(and(...conditions)).orderBy(desc(attendanceSummariesTable.date))
    : await db.select().from(attendanceSummariesTable).orderBy(desc(attendanceSummariesTable.date));

  res.json(summaries.map(serializeSummary));
});

// GET /api/attendance/my-history (employee own history)
router.get("/attendance/my-history", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const appUser = await getAppUser(req.user!.id);
  if (!appUser?.employeeId) {
    res.json([]);
    return;
  }

  const { from, to } = req.query as { from?: string; to?: string };

  const conditions = [eq(attendanceLogsTable.employeeId, appUser.employeeId)];
  if (from) conditions.push(gte(attendanceLogsTable.date, from));
  if (to) conditions.push(lte(attendanceLogsTable.date, to));

  const logs = await db
    .select()
    .from(attendanceLogsTable)
    .where(and(...conditions))
    .orderBy(desc(attendanceLogsTable.date));

  const results = await Promise.all(
    logs.map(async (log) => {
      const [summary] = await db
        .select()
        .from(attendanceSummariesTable)
        .where(and(
          eq(attendanceSummariesTable.employeeId, log.employeeId),
          eq(attendanceSummariesTable.date, log.date),
        ));
      return {
        log: serializeLog(log),
        summary: summary ? serializeSummary(summary) : null,
        employee: null,
      };
    }),
  );

  res.json(results);
});

// GET /api/attendance/stats (admin) — per-employee tallies for a period
router.get("/attendance/stats", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const appUser = await getAppUser(req.user!.id);
  if (!appUser || appUser.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { from, to } = req.query as { from?: string; to?: string };

  const employees = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.employmentStatus, "active"));

  const results = await Promise.all(
    employees.map(async (emp) => {
      const conditions = [eq(attendanceSummariesTable.employeeId, emp.id)];
      if (from) conditions.push(gte(attendanceSummariesTable.date, from));
      if (to) conditions.push(lte(attendanceSummariesTable.date, to));

      const summaries = await db
        .select()
        .from(attendanceSummariesTable)
        .where(and(...conditions));

      const presentCount = summaries.filter((s) => s.status === "present" || s.status === "late").length;
      const lateCount = summaries.filter((s) => s.isLate).length;
      const totalLateMinutes = summaries.reduce((sum, s) => sum + s.lateMinutes, 0);
      const totalLateDeductions = summaries
        .reduce((sum, s) => sum + parseFloat(s.lateDeductionAmount ?? "0"), 0)
        .toFixed(2);
      const totalHours = summaries
        .reduce((sum, s) => sum + parseFloat(s.regularHours ?? "0"), 0)
        .toFixed(2);
      const undertimeCount = summaries.filter((s) => s.undertimeMinutes > 0).length;
      const totalUndertimeMinutes = summaries.reduce((sum, s) => sum + s.undertimeMinutes, 0);
      const totalUndertimeDeductions = summaries
        .reduce((sum, s) => sum + parseFloat(s.undertimeDeductionAmount ?? "0"), 0)
        .toFixed(2);

      return {
        employeeId: emp.id,
        periodFrom: from ?? null,
        periodTo: to ?? null,
        presentCount,
        lateCount,
        totalLateMinutes,
        totalLateDeductions,
        totalHours,
        undertimeCount,
        totalUndertimeMinutes,
        totalUndertimeDeductions,
        employee: serializeEmployee(emp),
      };
    }),
  );

  res.json(results);
});

// GET /api/attendance/my-stats (employee own tally for a period)
router.get("/attendance/my-stats", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const appUser = await getAppUser(req.user!.id);
  if (!appUser?.employeeId) {
    res.status(400).json({ error: "No employee linked to this account" });
    return;
  }

  const { from, to } = req.query as { from?: string; to?: string };

  const conditions = [eq(attendanceSummariesTable.employeeId, appUser.employeeId)];
  if (from) conditions.push(gte(attendanceSummariesTable.date, from));
  if (to) conditions.push(lte(attendanceSummariesTable.date, to));

  const summaries = await db
    .select()
    .from(attendanceSummariesTable)
    .where(and(...conditions));

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, appUser.employeeId));

  const presentCount = summaries.filter((s) => s.status === "present" || s.status === "late").length;
  const lateCount = summaries.filter((s) => s.isLate).length;
  const totalLateMinutes = summaries.reduce((sum, s) => sum + s.lateMinutes, 0);
  const totalLateDeductions = summaries
    .reduce((sum, s) => sum + parseFloat(s.lateDeductionAmount ?? "0"), 0)
    .toFixed(2);
  const totalHours = summaries
    .reduce((sum, s) => sum + parseFloat(s.regularHours ?? "0"), 0)
    .toFixed(2);
  const undertimeCount = summaries.filter((s) => s.undertimeMinutes > 0).length;
  const totalUndertimeMinutes = summaries.reduce((sum, s) => sum + s.undertimeMinutes, 0);
  const totalUndertimeDeductions = summaries
    .reduce((sum, s) => sum + parseFloat(s.undertimeDeductionAmount ?? "0"), 0)
    .toFixed(2);

  res.json({
    employeeId: appUser.employeeId,
    periodFrom: from ?? null,
    periodTo: to ?? null,
    presentCount,
    lateCount,
    totalLateMinutes,
    totalLateDeductions,
    totalHours,
    undertimeCount,
    totalUndertimeMinutes,
    totalUndertimeDeductions,
    employee: employee ? serializeEmployee(employee) : null,
  });
});

export default router;
