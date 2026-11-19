import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://payroll-tests.invalid/payroll";

const {
  attendanceSummariesTable,
  cashAdvancesTable,
  employeesTable,
  overtimeLogsTable,
  payrollEntriesTable,
  payrollIncentivesTable,
  payrollPeriodsTable,
  specialWorkingDaysTable,
} = await import("@workspace/db");
const { canDeletePayrollPeriod, generatePayrollEntries, isCashAdvanceEligible } = await import("./payroll");

type Row = Record<string, any>;

class FakePayrollDatabase {
  employees: Row[] = [];
  summaries: Row[] = [];
  overtimeLogs: Row[] = [];
  cashAdvances: Row[] = [];
  specialWorkingDays: Row[] = [];
  payrollEntries: Row[] = [];
  incentives: Row[] = [];
  periods: Row[] = [];

  select() {
    return new FakeSelectQuery(this);
  }

  delete(table: unknown) {
    return new FakeDeleteQuery(this, table);
  }

  insert(table: unknown) {
    return new FakeInsertQuery(this, table);
  }

  update(table: unknown) {
    return new FakeUpdateQuery(this, table);
  }

  async transaction<T>(callback: (tx: this) => Promise<T>): Promise<T> {
    return callback(this);
  }

  rowsFor(table: unknown): Row[] {
    if (table === employeesTable) return this.employees;
    if (table === attendanceSummariesTable) return this.summaries;
    if (table === overtimeLogsTable) return this.overtimeLogs;
    if (table === cashAdvancesTable) return this.cashAdvances;
    if (table === specialWorkingDaysTable) return this.specialWorkingDays;
    if (table === payrollEntriesTable) return this.payrollEntries;
    if (table === payrollIncentivesTable) return this.incentives;
    if (table === payrollPeriodsTable) return this.periods;
    throw new Error("Unexpected table in fake query");
  }

  insertRows(table: unknown, values: Row | Row[]) {
    const rows = (Array.isArray(values) ? values : [values]).map((value) => ({
      ...value,
      id: value.id ?? `payroll-entry-${this.payrollEntries.length + 1}`,
      computedAt: value.computedAt ?? new Date("2026-08-03T00:00:00.000Z"),
    }));
    this.rowsFor(table).push(...rows);
    return rows;
  }

  deleteRows(table: unknown) {
    const rows = this.rowsFor(table);
    rows.splice(0, rows.length);
  }

  updateRows(table: unknown, values: Row) {
    const rows = this.rowsFor(table);
    if (rows.length > 0) Object.assign(rows[0], values);
    return rows.length > 0 ? [rows[0]] : [];
  }
}

class FakeSelectQuery {
  private table: unknown;

  constructor(private readonly database: FakePayrollDatabase) {}

  from(table: unknown) {
    this.table = table;
    return this;
  }

  where() {
    return this;
  }

  then(resolve: (value: Row[]) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve(this.database.rowsFor(this.table)).then(resolve, reject);
  }
}

class FakeDeleteQuery {
  constructor(
    private readonly database: FakePayrollDatabase,
    private readonly table: unknown,
  ) {}

  where() {
    return this;
  }

  then(resolve: (value: void) => unknown, reject?: (reason: unknown) => unknown) {
    try {
      this.database.deleteRows(this.table);
      return Promise.resolve().then(resolve, reject);
    } catch (error) {
      return Promise.reject(error).then(resolve, reject);
    }
  }
}

class FakeInsertQuery {
  private valuesToInsert: Row | Row[] = {};

  constructor(
    private readonly database: FakePayrollDatabase,
    private readonly table: unknown,
  ) {}

  values(values: Row | Row[]) {
    this.valuesToInsert = values;
    return this;
  }

  then(resolve: (value: Row[]) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve(
      this.database.insertRows(this.table, this.valuesToInsert),
    ).then(resolve, reject);
  }
}

class FakeUpdateQuery {
  private valuesToUpdate: Row = {};

  constructor(
    private readonly database: FakePayrollDatabase,
    private readonly table: unknown,
  ) {}

  set(values: Row) {
    this.valuesToUpdate = values;
    return this;
  }

  where() {
    return this;
  }

  returning() {
    return Promise.resolve(this.database.updateRows(this.table, this.valuesToUpdate));
  }

  then(resolve: (value: void) => unknown, reject?: (reason: unknown) => unknown) {
    try {
      this.database.updateRows(this.table, this.valuesToUpdate);
      return Promise.resolve().then(resolve, reject);
    } catch (error) {
      return Promise.reject(error).then(resolve, reject);
    }
  }
}

test("admins can delete draft or approved payroll periods but not paid periods", () => {
  assert.equal(canDeletePayrollPeriod("draft"), true);
  assert.equal(canDeletePayrollPeriod("approved"), true);
  assert.equal(canDeletePayrollPeriod("paid"), false);
});

test("cash advances wait until the admin-selected deduction date", () => {
  const advance = {
    advanceDate: "2026-09-01",
    deductionDate: "2026-09-30",
    deductedPayrollPeriodId: null,
  };
  assert.equal(isCashAdvanceEligible(advance, "period-1", "2026-09-19"), false);
  assert.equal(isCashAdvanceEligible(advance, "period-2", "2026-09-30"), true);
});

test("payroll deducts only the cash advances explicitly selected by the admin", async () => {
  const database = new FakePayrollDatabase();
  database.employees.push({
    id: "employee-1",
    employmentStatus: "active",
    dailyRate: "800.00",
    overtimeRate: "150.00",
  });
  database.summaries.push({
    employeeId: "employee-1",
    date: "2026-08-03",
    status: "present",
    isLate: false,
    lateMinutes: 0,
    lateDeductionAmount: "0.00",
    undertimeMinutes: 0,
    undertimeDeductionAmount: "0.00",
    regularHours: "8.00",
  });
  database.overtimeLogs.push({
    employeeId: "employee-1",
    periodDate: "2026-08-03",
    status: "ot_completed",
    approvedOvertimeHours: "1.50",
  });
  database.cashAdvances.push({
    id: "cash-advance-1",
    employeeId: "employee-1",
    amount: "100.00",
    advanceDate: "2026-08-03",
    deductedPayrollPeriodId: null,
  });
  database.cashAdvances.push({
    id: "cash-advance-2",
    employeeId: "employee-1",
    amount: "250.00",
    advanceDate: "2026-08-03",
    deductedPayrollPeriodId: null,
  });
  database.periods.push({
    id: "period-1",
    status: "draft",
  });

  await generatePayrollEntries(
    "period-1",
    "2026-08-03",
    "2026-08-03",
    ["employee-1"],
    database as any,
    ["cash-advance-1"],
  );

  assert.equal(database.summaries[0].regularHours, "8.00");
  assert.equal(database.payrollEntries.length, 1);
  assert.deepEqual(database.payrollEntries[0], {
    payrollPeriodId: "period-1",
    employeeId: "employee-1",
    dailyRateSnapshot: "800.00",
    daysPresent: 1,
    daysAbsent: 0,
    lateCount: 0,
    totalLateMinutes: 0,
    undertimeCount: 0,
    totalUndertimeMinutes: 0,
    regularPay: "800.00",
    lateDeductionTotal: "0.00",
    undertimeDeductionTotal: "0.00",
    cashAdvanceDeduction: "100.00",
    overtimePay: "225.00",
    incentivePay: "0.00",
    grossPay: "1025.00",
    netPay: "925.00",
    id: "payroll-entry-1",
    computedAt: new Date("2026-08-03T00:00:00.000Z"),
  });
  assert.equal(database.cashAdvances[0].deductedPayrollPeriodId, "period-1");
  assert.equal(database.cashAdvances[1].deductedPayrollPeriodId, null);
});

test("recalculating preserves incentives without adding them twice", async () => {
  const database = new FakePayrollDatabase();
  database.periods.push({ id: "period-1", status: "draft" });
  database.employees.push({ id: "employee-1", employmentStatus: "active", dailyRate: "800.00" });
  database.summaries.push({
    employeeId: "employee-1", date: "2026-08-03", status: "present",
    isLate: false, lateMinutes: 0, lateDeductionAmount: "0",
    undertimeMinutes: 0, undertimeDeductionAmount: "0", regularHours: "8.00",
  });
  database.incentives.push({ payrollPeriodId: "period-1", employeeId: "employee-1", weeklyAmount: "800.00", weeks: 2, note: "" });
  for (let run = 0; run < 2; run++) {
    await generatePayrollEntries("period-1", "2026-08-03", "2026-08-03", ["employee-1"], database as any, []);
    assert.equal(database.payrollEntries.length, 1);
    assert.equal(database.payrollEntries[0].incentivePay, "1600.00");
    assert.equal(database.payrollEntries[0].grossPay, "2400.00");
    assert.equal(database.payrollEntries[0].netPay, "2400.00");
    assert.equal(database.incentives[0].weeklyAmount, "800.00");
  }
});

test("payroll includes recorded weekend attendance without masking weekday absences", async () => {
  const database = new FakePayrollDatabase();
  database.employees.push({
    id: "employee-1",
    employmentStatus: "active",
    dailyRate: "743.00",
  });
  for (const date of [
    "2026-09-06",
    "2026-09-07",
    "2026-09-08",
    "2026-09-09",
    "2026-09-10",
    "2026-09-11",
  ]) {
    database.summaries.push({
      employeeId: "employee-1",
      date,
      status: "present",
      isLate: false,
      lateMinutes: 0,
      lateDeductionAmount: "0.00",
      undertimeMinutes: 0,
      undertimeDeductionAmount: "0.00",
      regularHours: "8.00",
    });
  }
  database.periods.push({
    id: "period-1",
    status: "draft",
  });

  await generatePayrollEntries(
    "period-1",
    "2026-09-06",
    "2026-09-11",
    ["employee-1"],
    database as any,
  );

  assert.equal(database.payrollEntries[0].daysPresent, 6);
  assert.equal(database.payrollEntries[0].daysAbsent, 0);
  assert.equal(database.payrollEntries[0].regularPay, "4458.00");

  database.summaries.splice(
    database.summaries.findIndex((summary) => summary.date === "2026-09-11"),
    1,
  );

  await generatePayrollEntries(
    "period-1",
    "2026-09-06",
    "2026-09-11",
    ["employee-1"],
    database as any,
  );

  assert.equal(database.payrollEntries[0].daysPresent, 5);
  assert.equal(database.payrollEntries[0].daysAbsent, 1);
  assert.equal(database.payrollEntries[0].regularPay, "3715.00");
});

test("payroll uses weekday-specific daily rates and falls back to the default rate", async () => {
  const database = new FakePayrollDatabase();
  database.employees.push({
    id: "employee-1",
    employmentStatus: "active",
    dailyRate: "700.00",
    mondayRate: "800.00",
    tuesdayRate: "900.00",
  });
  for (const date of ["2026-08-03", "2026-08-04", "2026-08-05"]) {
    database.summaries.push({
      employeeId: "employee-1",
      date,
      status: "present",
      isLate: false,
      lateMinutes: 0,
      lateDeductionAmount: "0.00",
      undertimeMinutes: 0,
      undertimeDeductionAmount: "0.00",
    });
  }
  database.periods.push({ id: "period-1", status: "draft" });

  await generatePayrollEntries(
    "period-1",
    "2026-08-03",
    "2026-08-05",
    ["employee-1"],
    database as any,
  );

  assert.equal(database.payrollEntries[0].daysPresent, 3);
  assert.equal(database.payrollEntries[0].regularPay, "2400.00");
});

test("payroll generation rejects an empty employee selection without changing the period", async () => {
  const database = new FakePayrollDatabase();
  database.periods.push({
    id: "period-1",
    status: "approved",
    generatedAt: new Date("2026-08-02T00:00:00.000Z"),
  });
  database.payrollEntries.push({ id: "existing-entry" });

  await assert.rejects(
    generatePayrollEntries(
      "period-1",
      "2026-08-03",
      "2026-08-03",
      [],
      database as any,
    ),
    /Select at least one active employee/,
  );

  assert.equal(database.payrollEntries.length, 1);
  assert.equal(database.periods[0].status, "approved");
  assert.equal(database.periods[0].generatedAt.toISOString(), "2026-08-02T00:00:00.000Z");
});