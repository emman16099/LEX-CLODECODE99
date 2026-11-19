import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://attendance-tests.invalid/attendance";

const {
  attendanceCorrectionsTable,
  attendanceLogsTable,
  attendanceRulesTable,
  attendanceSummariesTable,
  employeesTable,
  overtimeCorrectionsTable,
  overtimeLogsTable,
  payrollEntriesTable,
  payrollPeriodsTable,
} = await import("@workspace/db");
const { applyAttendanceCorrection, recordManualAttendance, ManualAttendanceError } = await import("./attendance");

type Row = Record<string, any>;

class FakeAttendanceDatabase {
  logs: Row[] = [];
  rules: Row[] = [];
  employees: Row[] = [];
  summaries: Row[] = [];
  corrections: Row[] = [];
  overtimeLogs: Row[] = [];
  overtimeCorrections: Row[] = [];
  payrollPeriods: Row[] = [];
  payrollEntries: Row[] = [];

  select() {
    return new FakeSelectQuery(this);
  }

  update(table: unknown) {
    return new FakeUpdateQuery(this, table);
  }

  insert(table: unknown) {
    return new FakeInsertQuery(this, table);
  }

  delete(table: unknown) {
    return new FakeDeleteQuery(this, table);
  }

  async transaction<T>(callback: (tx: this) => Promise<T>): Promise<T> {
    return callback(this);
  }

  rowsFor(table: unknown): Row[] {
    if (table === attendanceLogsTable) return this.logs;
    if (table === attendanceRulesTable) return this.rules;
    if (table === employeesTable) return this.employees;
    if (table === attendanceSummariesTable) return this.summaries;
    if (table === attendanceCorrectionsTable) return [...this.corrections].reverse();
    if (table === overtimeLogsTable) return this.overtimeLogs;
    if (table === overtimeCorrectionsTable) return this.overtimeCorrections;
    if (table === payrollPeriodsTable) return this.payrollPeriods;
    if (table === payrollEntriesTable) return this.payrollEntries;
    throw new Error("Unexpected table in fake query");
  }

  storedRowsFor(table: unknown): Row[] {
    if (table === attendanceLogsTable) return this.logs;
    if (table === attendanceRulesTable) return this.rules;
    if (table === employeesTable) return this.employees;
    if (table === attendanceSummariesTable) return this.summaries;
    if (table === attendanceCorrectionsTable) return this.corrections;
    if (table === overtimeLogsTable) return this.overtimeLogs;
    if (table === overtimeCorrectionsTable) return this.overtimeCorrections;
    if (table === payrollPeriodsTable) return this.payrollPeriods;
    if (table === payrollEntriesTable) return this.payrollEntries;
    throw new Error("Unexpected table in fake query");
  }

  applyUpdate(table: unknown, values: Row): Row[] {
    const rows = this.storedRowsFor(table);
    if (rows.length === 0) return [];
    Object.assign(rows[0], values);
    return [rows[0]];
  }

  applyInsert(table: unknown, values: Row | Row[]): Row[] {
    const inserted = (Array.isArray(values) ? values : [values]).map((value, index) => ({
      ...value,
      id: value.id ?? `correction-${this.corrections.length + index + 1}`,
      createdAt: value.createdAt ?? new Date(`2026-08-30T0${index + 1}:00:00.000Z`),
    }));
    const rows = this.storedRowsFor(table);
    rows.push(...inserted);
    return inserted;
  }
}

class FakeDeleteQuery {
  constructor(
    private readonly database: FakeAttendanceDatabase,
    private readonly table: unknown,
  ) {}

  where() {
    const rows = this.database.storedRowsFor(this.table);
    rows.splice(0, rows.length);
    return Promise.resolve();
  }
}

class FakeSelectQuery {
  private table: unknown;

  constructor(private readonly database: FakeAttendanceDatabase) {}

  from(table: unknown) {
    this.table = table;
    return this;
  }

  where() {
    return this;
  }

  orderBy() {
    return this;
  }

  then(resolve: (value: Row[]) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve(this.database.rowsFor(this.table)).then(resolve, reject);
  }
}

class FakeUpdateQuery {
  private values: Row = {};

  constructor(
    private readonly database: FakeAttendanceDatabase,
    private readonly table: unknown,
  ) {}

  set(values: Row) {
    this.values = values;
    return this;
  }

  where() {
    return this;
  }

  returning() {
    return Promise.resolve(this.database.applyUpdate(this.table, this.values));
  }

  then(resolve: (value: Row[]) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve(this.database.applyUpdate(this.table, this.values)).then(resolve, reject);
  }
}

class FakeInsertQuery {
  private valuesToInsert: Row | Row[] = {};

  constructor(
    private readonly database: FakeAttendanceDatabase,
    private readonly table: unknown,
  ) {}

  values(values: Row | Row[]) {
    this.valuesToInsert = values;
    return this;
  }

  onConflictDoNothing() {
    return this;
  }

  returning() {
    return Promise.resolve(this.database.applyInsert(this.table, this.valuesToInsert));
  }

  then(resolve: (value: Row[]) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve(this.database.applyInsert(this.table, this.valuesToInsert)).then(resolve, reject);
  }
}

function phtTime(hour: number, minute: number): Date {
  return new Date(Date.UTC(2026, 7, 30, hour - 8, minute));
}

test("correction recalculates the summary and preserves the append-only audit history", async () => {
  const database = new FakeAttendanceDatabase();
  database.rules.push({
    id: "standard-8-to-5",
    shiftStart: "08:00",
    shiftEnd: "17:00",
    lateCutoff: "08:00",
    graceMinutes: 5,
    clockOutGraceMinutes: 5,
    breakMinutes: 60,
    lateDeductionMode: "none",
    lateDeductionValue: null,
  });
  database.employees.push({ id: "employee-1", dailyRate: "800.00" });
  database.logs.push({
    id: "log-1",
    employeeId: "employee-1",
    attendanceRuleId: "standard-8-to-5",
    date: "2026-08-30",
    clockInAt: phtTime(8, 6),
    clockOutAt: phtTime(17, 0),
    earlyClockOutReason: null,
  });
  database.summaries.push({
    id: "summary-1",
    employeeId: "employee-1",
    attendanceLogId: "log-1",
    date: "2026-08-30",
    status: "late",
    isLate: true,
    lateMinutes: 1,
    regularHours: "7.90",
    lateDeductionAmount: "0.00",
    undertimeMinutes: 0,
    undertimeDeductionAmount: "0.00",
  });

  const first = await applyAttendanceCorrection(
    "log-1",
    { clockInAt: phtTime(8, 0), reason: "Corrected from signed attendance sheet" },
    [{
      field: "clock_in",
      previousValue: phtTime(8, 6),
      newValue: phtTime(8, 0),
    }],
    "admin-1",
    "Admin User",
    database as any,
  );

  assert.equal(first.summary.isLate, false);
  assert.equal(first.summary.lateMinutes, 0);
  assert.equal(first.corrections.length, 1);
  assert.equal(first.corrections[0].reason, "Corrected from signed attendance sheet");

  const second = await applyAttendanceCorrection(
    "log-1",
    { clockOutAt: phtTime(16, 55), reason: "Updated to approved grace boundary" },
    [{
      field: "clock_out",
      previousValue: phtTime(17, 0),
      newValue: phtTime(16, 55),
    }],
    "admin-1",
    "Admin User",
    database as any,
  );

  assert.equal(second.summary.undertimeMinutes, 0);
  assert.equal(second.summary.regularHours, "7.92");
  assert.equal(second.corrections.length, 2);
  assert.deepEqual(
    second.corrections.map((correction) => correction.field),
    ["clock_out", "clock_in"],
  );
  assert.deepEqual(
    second.corrections.map((correction) => correction.reason),
    ["Updated to approved grace boundary", "Corrected from signed attendance sheet"],
  );
  assert.equal(database.corrections.length, 2);
});

test("correction stores per-date daily rate and late deduction overrides", async () => {
  const database = new FakeAttendanceDatabase();
  database.employees.push({ id: "employee-1", dailyRate: "800.00" });
  database.logs.push({
    id: "log-1",
    employeeId: "employee-1",
    attendanceRuleId: null,
    date: "2026-08-30",
    clockInAt: phtTime(8, 16),
    clockOutAt: phtTime(17, 0),
    earlyClockOutReason: null,
  });
  database.summaries.push({
    id: "summary-1",
    employeeId: "employee-1",
    attendanceLogId: "log-1",
    date: "2026-08-30",
    status: "late",
    isLate: true,
    lateMinutes: 11,
    regularHours: "8.73",
    dailyRateOverride: null,
    lateDeductionAmount: "18.33",
    lateDeductionOverride: null,
    undertimeMinutes: 0,
    undertimeDeductionAmount: "0.00",
  });

  const result = await applyAttendanceCorrection(
    "log-1",
    {
      dailyRate: 950,
      lateDeduction: 25,
      reason: "Approved rate and deduction adjustment",
    },
    [],
    "admin-1",
    "Admin User",
    database as any,
  );

  assert.equal(result.summary.dailyRateOverride, "950.00");
  assert.equal(result.summary.lateDeductionAmount, "25.00");
  assert.equal(result.summary.lateDeductionOverride, "25.00");
  assert.equal(
    result.corrections.find((correction) => correction.field === "daily_rate")?.previousAmount,
    "800.00",
  );
  assert.deepEqual(
    result.corrections.map((correction) => correction.field).sort(),
    ["daily_rate", "late_deduction"],
  );
});

test("correction updates finalized overtime hours and preserves the previous approved value", async () => {
  const database = new FakeAttendanceDatabase();
  database.rules.push({
    id: "standard-8-to-5",
    shiftStart: "08:00",
    shiftEnd: "17:00",
    lateCutoff: "08:00",
    graceMinutes: 5,
    clockOutGraceMinutes: 5,
    breakMinutes: 60,
    lateDeductionMode: "none",
    lateDeductionValue: null,
  });
  database.employees.push({ id: "employee-1", dailyRate: "800.00" });
  database.logs.push({
    id: "log-1",
    employeeId: "employee-1",
    attendanceRuleId: "standard-8-to-5",
    date: "2026-08-30",
    clockInAt: phtTime(8, 0),
    clockOutAt: phtTime(17, 0),
    earlyClockOutReason: null,
  });
  database.summaries.push({
    id: "summary-1",
    employeeId: "employee-1",
    attendanceLogId: "log-1",
    date: "2026-08-30",
    status: "present",
    isLate: false,
    lateMinutes: 0,
    regularHours: "8.00",
    lateDeductionAmount: "0.00",
    undertimeMinutes: 0,
    undertimeDeductionAmount: "0.00",
  });
  database.overtimeLogs.push({
    id: "ot-1",
    employeeId: "employee-1",
    attendanceLogId: "log-1",
    periodDate: "2026-08-30",
    status: "ot_completed",
    otInTime: phtTime(17, 0),
    otOutTime: phtTime(19, 0),
    approvedOvertimeHours: "2.00",
  });

  await applyAttendanceCorrection(
    "log-1",
    { overtimeHours: 1.5, reason: "Corrected from signed overtime sheet" },
    [],
    "admin-1",
    "Admin User",
    database as any,
  );

  assert.equal(database.overtimeLogs[0].approvedOvertimeHours, "1.50");
  assert.equal(database.overtimeCorrections.length, 1);
  assert.equal(database.overtimeCorrections[0].action, "correct_approved_hours");
  assert.equal(database.overtimeCorrections[0].originalApprovedHours, "2.00");
  assert.equal(database.overtimeCorrections[0].correctedApprovedHours, "1.50");
  assert.equal(database.overtimeCorrections[0].reason, "Corrected from signed overtime sheet");
});

test("correction manually creates finalized overtime when no overtime record exists", async () => {
  const database = new FakeAttendanceDatabase();
  database.logs.push({
    id: "log-1",
    employeeId: "employee-1",
    attendanceRuleId: null,
    date: "2026-08-30",
    clockInAt: phtTime(8, 0),
    clockOutAt: phtTime(17, 0),
  });
  database.employees.push({ id: "employee-1", dailyRate: "800.00" });
  database.summaries.push({
    id: "summary-1",
    employeeId: "employee-1",
    attendanceLogId: "log-1",
    date: "2026-08-30",
    status: "present",
    isLate: false,
    lateMinutes: 0,
    regularHours: "8.00",
    lateDeductionAmount: "0.00",
    undertimeMinutes: 0,
    undertimeDeductionAmount: "0.00",
  });

  await applyAttendanceCorrection(
    "log-1",
    { overtimeHours: 2.25, reason: "Approved field overtime from signed sheet" },
    [],
    "admin-1",
    "Admin User",
    database as any,
  );

  assert.equal(database.overtimeLogs.length, 1);
  assert.equal(database.overtimeLogs[0].employeeId, "employee-1");
  assert.equal(database.overtimeLogs[0].periodDate, "2026-08-30");
  assert.equal(database.overtimeLogs[0].attendanceLogId, "log-1");
  assert.equal(database.overtimeLogs[0].status, "ot_completed");
  assert.equal(database.overtimeLogs[0].assignmentSource, "manual_correction");
  assert.equal(database.overtimeLogs[0].approvedOvertimeHours, "2.25");
  assert.equal(database.overtimeCorrections.length, 1);
  assert.equal(database.overtimeCorrections[0].action, "manual_add_approved_hours");
  assert.equal(database.overtimeCorrections[0].originalApprovedHours, null);
  assert.equal(database.overtimeCorrections[0].correctedApprovedHours, "2.25");
});

test("correction invalidates generated draft payroll so stale overtime cannot be approved", async () => {
  const database = new FakeAttendanceDatabase();
  database.logs.push({
    id: "log-1",
    employeeId: "employee-1",
    attendanceRuleId: null,
    date: "2026-08-30",
    clockInAt: phtTime(8, 0),
    clockOutAt: phtTime(17, 0),
  });
  database.employees.push({ id: "employee-1", dailyRate: "800.00" });
  database.summaries.push({
    id: "summary-1",
    employeeId: "employee-1",
    attendanceLogId: "log-1",
    date: "2026-08-30",
    status: "present",
    isLate: false,
    lateMinutes: 0,
    regularHours: "8.00",
    lateDeductionAmount: "0.00",
    undertimeMinutes: 0,
    undertimeDeductionAmount: "0.00",
  });
  database.overtimeLogs.push({
    id: "ot-1",
    employeeId: "employee-1",
    periodDate: "2026-08-30",
    status: "ot_completed",
    otInTime: phtTime(17, 0),
    otOutTime: phtTime(19, 0),
    approvedOvertimeHours: "2.00",
  });
  database.payrollPeriods.push({
    id: "payroll-1",
    startDate: "2026-08-16",
    endDate: "2026-08-31",
    status: "draft",
    generatedAt: new Date("2026-08-31T00:00:00.000Z"),
    approvedAt: null,
  });
  database.payrollEntries.push({
    id: "entry-1",
    payrollPeriodId: "payroll-1",
    employeeId: "employee-1",
    overtimePay: "250.00",
  });

  await applyAttendanceCorrection(
    "log-1",
    { overtimeHours: 1.5, reason: "Corrected from signed overtime sheet" },
    [],
    "admin-1",
    "Admin User",
    database as any,
  );

  assert.equal(database.payrollPeriods[0].generatedAt, null);
  assert.equal(database.payrollEntries.length, 0);
});

test("correction reopens an approved payroll as draft and removes its stale snapshot", async () => {
  const database = new FakeAttendanceDatabase();
  const originalClockIn = phtTime(8, 0);
  const correctedClockIn = phtTime(8, 15);
  database.logs.push({
    id: "log-1", employeeId: "employee-1", attendanceRuleId: null,
    date: "2026-08-30", clockInAt: originalClockIn, clockOutAt: phtTime(17, 0),
  });
  database.employees.push({ id: "employee-1", dailyRate: "800.00" });
  database.payrollPeriods.push({
    id: "payroll-1", startDate: "2026-08-16", endDate: "2026-08-31",
    status: "approved", approvedAt: new Date(), generatedAt: new Date(),
  });
  database.payrollEntries.push({ id: "entry-1", payrollPeriodId: "payroll-1", employeeId: "employee-1" });

  await applyAttendanceCorrection(
    "log-1",
    { clockInAt: correctedClockIn, reason: "Signed timesheet correction" },
    [{ field: "clock_in", previousValue: originalClockIn, newValue: correctedClockIn }],
    "admin-1", "Admin User", database as any,
  );

  assert.equal(database.payrollPeriods[0].status, "draft");
  assert.equal(database.payrollPeriods[0].approvedAt, null);
  assert.equal(database.payrollPeriods[0].generatedAt, null);
  assert.equal(database.payrollEntries.length, 0);
  assert.equal(database.logs[0].clockInAt, correctedClockIn);
  assert.equal(database.corrections.length, 1);
});

test("correction keeps a paid payroll and its attendance unchanged", async () => {
  const database = new FakeAttendanceDatabase();
  const originalClockIn = phtTime(8, 0);
  const correctedClockIn = phtTime(8, 15);
  database.logs.push({
    id: "log-1", employeeId: "employee-1", attendanceRuleId: null,
    date: "2026-08-30", clockInAt: originalClockIn, clockOutAt: phtTime(17, 0),
  });
  database.payrollPeriods.push({
    id: "payroll-1", startDate: "2026-08-16", endDate: "2026-08-31",
    status: "paid", approvedAt: new Date(), generatedAt: new Date(),
  });
  database.payrollEntries.push({ id: "entry-1", payrollPeriodId: "payroll-1", employeeId: "employee-1" });

  await assert.rejects(
    applyAttendanceCorrection(
      "log-1",
      { clockInAt: correctedClockIn, reason: "Signed timesheet correction" },
      [{ field: "clock_in", previousValue: originalClockIn, newValue: correctedClockIn }],
      "admin-1", "Admin User", database as any,
    ),
    /paid payroll period/,
  );
  assert.equal(database.payrollPeriods[0].status, "paid");
  assert.equal(database.payrollEntries.length, 1);
  assert.equal(database.logs[0].clockInAt, originalClockIn);
});

test("manual attendance reopens an approved payroll before recording a time", async () => {
  const database = new FakeAttendanceDatabase();
  database.employees.push({ id: "employee-1", dailyRate: "800.00" });
  database.payrollPeriods.push({
    id: "payroll-1", startDate: "2026-08-16", endDate: "2026-08-31",
    status: "approved", approvedAt: new Date(), generatedAt: new Date(),
  });
  database.payrollEntries.push({ id: "entry-1", payrollPeriodId: "payroll-1", employeeId: "employee-1" });

  await recordManualAttendance({
    employeeId: "employee-1", date: "2026-08-30", action: "clock_in",
    timestamp: phtTime(8, 0), reason: "Verified timesheet",
    correctedBy: "admin-1", correctedByName: "Admin User",
  }, database as any);

  assert.equal(database.payrollPeriods[0].status, "draft");
  assert.equal(database.payrollPeriods[0].approvedAt, null);
  assert.equal(database.payrollPeriods[0].generatedAt, null);
  assert.equal(database.payrollEntries.length, 0);
  assert.equal(database.corrections.length, 1);
});

test("manual attendance creates a clock-in and records the Manila timestamp in the audit trail", async () => {
  const database = new FakeAttendanceDatabase();
  database.rules.push({
    id: "standard-8-to-5",
    shiftStart: "08:00",
    shiftEnd: "17:00",
    lateCutoff: "08:00",
    graceMinutes: 5,
    clockOutGraceMinutes: 5,
    breakMinutes: 60,
    lateDeductionMode: "none",
    lateDeductionValue: null,
  });
  database.employees.push({ id: "employee-1", dailyRate: "800.00" });

  const result = await recordManualAttendance({
    employeeId: "employee-1",
    date: "2026-08-31",
    action: "clock_in",
    timestamp: phtTime(8, 0),
    attendanceRuleId: "standard-8-to-5",
    reason: "Employee was assigned to fieldwork with no internet access",
    correctedBy: "admin-1",
    correctedByName: "Admin User",
  }, database as any);

  assert.equal(result.updated.clockInAt?.toISOString(), "2026-08-30T00:00:00.000Z");
  assert.equal(result.updated.date, "2026-08-31");
  assert.equal(result.summary.status, "missing_logout");
  assert.equal(result.corrections.length, 1);
  assert.equal(result.corrections[0].field, "clock_in");
  assert.equal(result.corrections[0].previousValue, null);
  assert.equal(result.corrections[0].newValue?.toISOString(), "2026-08-30T00:00:00.000Z");
  assert.equal(result.corrections[0].reason, "Employee was assigned to fieldwork with no internet access");
});

test("manual attendance completes an existing clock-in and recalculates the summary", async () => {
  const database = new FakeAttendanceDatabase();
  database.rules.push({
    id: "standard-8-to-5",
    shiftStart: "08:00",
    shiftEnd: "17:00",
    lateCutoff: "08:00",
    graceMinutes: 5,
    clockOutGraceMinutes: 5,
    breakMinutes: 60,
    lateDeductionMode: "none",
    lateDeductionValue: null,
  });
  database.employees.push({ id: "employee-1", dailyRate: "800.00" });
  database.logs.push({
    id: "log-1",
    employeeId: "employee-1",
    attendanceRuleId: "standard-8-to-5",
    date: "2026-08-31",
    clockInAt: phtTime(8, 0),
    clockOutAt: null,
    earlyClockOutReason: null,
  });

  const result = await recordManualAttendance({
    employeeId: "employee-1",
    date: "2026-08-31",
    action: "clock_out",
    timestamp: phtTime(17, 0),
    reason: "Employee returned from client fieldwork",
    correctedBy: "admin-1",
    correctedByName: "Admin User",
  }, database as any);

  assert.equal(result.updated.clockOutAt?.toISOString(), "2026-08-30T09:00:00.000Z");
  assert.equal(result.summary.status, "present");
  assert.equal(result.summary.regularHours, "8.00");
  assert.equal(result.corrections.length, 1);
  assert.equal(result.corrections[0].field, "clock_out");
  assert.equal(result.corrections[0].previousValue, null);
  assert.equal(result.corrections[0].reason, "Employee returned from client fieldwork");
});

test("manual attendance rejects duplicate, missing, and out-of-order actions", async () => {
  const duplicateDatabase = new FakeAttendanceDatabase();
  duplicateDatabase.logs.push({
    id: "log-1",
    employeeId: "employee-1",
    date: "2026-08-31",
    clockInAt: phtTime(8, 0),
    clockOutAt: null,
  });

  await assert.rejects(
    recordManualAttendance({
      employeeId: "employee-1",
      date: "2026-08-31",
      action: "clock_in",
      timestamp: phtTime(8, 1),
      reason: "Duplicate test",
      correctedBy: "admin-1",
      correctedByName: "Admin User",
    }, duplicateDatabase as any),
    (error: unknown) => error instanceof ManualAttendanceError && error.message === "Employee is already clocked in for this date",
  );

  const missingDatabase = new FakeAttendanceDatabase();
  await assert.rejects(
    recordManualAttendance({
      employeeId: "employee-1",
      date: "2026-08-31",
      action: "clock_out",
      timestamp: phtTime(17, 0),
      reason: "Missing clock-in test",
      correctedBy: "admin-1",
      correctedByName: "Admin User",
    }, missingDatabase as any),
    (error: unknown) => error instanceof ManualAttendanceError && error.message === "Clock-in is required before recording a clock-out",
  );

  const orderingDatabase = new FakeAttendanceDatabase();
  orderingDatabase.logs.push({
    id: "log-1",
    employeeId: "employee-1",
    date: "2026-08-31",
    clockInAt: phtTime(8, 0),
    clockOutAt: null,
  });
  await assert.rejects(
    recordManualAttendance({
      employeeId: "employee-1",
      date: "2026-08-31",
      action: "clock_out",
      timestamp: phtTime(7, 59),
      reason: "Ordering test",
      correctedBy: "admin-1",
      correctedByName: "Admin User",
    }, orderingDatabase as any),
    (error: unknown) => error instanceof ManualAttendanceError && error.message === "Clock-out cannot be earlier than clock-in",
  );
});