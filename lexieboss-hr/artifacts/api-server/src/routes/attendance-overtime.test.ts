import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://attendance-overtime-tests.invalid/test";

const {
  attendanceLogsTable,
  attendanceRulesTable,
  employeesTable,
  overtimeLogsTable,
} = await import("@workspace/db");
const { recordGateClockIn } = await import("./attendance");
const {
  getManualOvertimeControlError,
  isMatchedEarlyOvertime,
  reconcileCompletedEarlyOvertime,
} = await import("./overtime");

type Row = Record<string, any>;

class FakeAttendanceOvertimeDatabase {
  employees: Row[] = [];
  rules: Row[] = [];
  attendanceLogs: Row[] = [];
  overtimeLogs: Row[] = [];
  transactionCount = 0;
  transactionOperations: string[] = [];

  select() {
    return new FakeSelectQuery(this);
  }

  update(table: unknown) {
    return new FakeUpdateQuery(this, table);
  }

  insert(table: unknown) {
    return new FakeInsertQuery(this, table);
  }

  async transaction<T>(callback: (tx: this) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    return callback(this);
  }

  rowsFor(table: unknown): Row[] {
    if (table === employeesTable) return this.employees;
    if (table === attendanceRulesTable) return this.rules;
    if (table === attendanceLogsTable) return this.attendanceLogs;
    if (table === overtimeLogsTable) return this.overtimeLogs;
    throw new Error("Unexpected table in fake query");
  }

  joinedOvertimeRows(): Row[] {
    return this.overtimeLogs.flatMap((overtime) => {
      const attendance = this.attendanceLogs.find(
        (log) =>
          log.employeeId === overtime.employeeId &&
          log.date === overtime.periodDate,
      );
      const rule = this.rules.find(
        (candidate) => candidate.id === attendance?.attendanceRuleId,
      );
      return attendance && rule
        ? [{
            id: overtime.id,
            periodDate: overtime.periodDate,
            plannedStartTime: overtime.plannedStartTime,
            plannedEndTime: overtime.plannedEndTime,
            shiftStart: rule.shiftStart,
          }]
        : [];
    });
  }

  applyUpdate(table: unknown, values: Row): Row[] {
    const rows = this.rowsFor(table);
    const row =
      table === overtimeLogsTable
        ? rows.find((candidate) => candidate.status === "ot_approved" || candidate.status === "ot_in_progress")
        : rows.find((candidate) => !candidate.clockInAt) ?? rows[0];
    if (!row) return [];
    Object.assign(row, values);
    this.transactionOperations.push(`update:${table === overtimeLogsTable ? "overtime" : "attendance"}`);
    return [row];
  }

  applyInsert(table: unknown, values: Row): Row[] {
    const row = {
      ...values,
      id: values.id ?? `attendance-${this.attendanceLogs.length + 1}`,
    };
    this.rowsFor(table).push(row);
    this.transactionOperations.push("insert:attendance");
    return [row];
  }
}

class FakeSelectQuery {
  private table: unknown;
  private joined = false;

  constructor(private readonly database: FakeAttendanceOvertimeDatabase) {}

  from(table: unknown) {
    this.table = table;
    return this;
  }

  innerJoin() {
    this.joined = true;
    return this;
  }

  where() {
    return this;
  }

  then(resolve: (value: Row[]) => unknown, reject?: (reason: unknown) => unknown) {
    const rows = this.joined && this.table === overtimeLogsTable
      ? this.database.joinedOvertimeRows()
      : this.database.rowsFor(this.table);
    return Promise.resolve(rows).then(resolve, reject);
  }
}

class FakeUpdateQuery {
  private values: Row = {};

  constructor(
    private readonly database: FakeAttendanceOvertimeDatabase,
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
  private valuesToInsert: Row = {};

  constructor(
    private readonly database: FakeAttendanceOvertimeDatabase,
    private readonly table: unknown,
  ) {}

  values(values: Row) {
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
    return this.returning().then(resolve, reject);
  }
}

function phtTime(hour: number, minute: number): Date {
  return new Date(Date.UTC(2026, 7, 30, hour - 8, minute));
}

function activeRule(id: string, shiftStart: string): Row {
  return {
    id,
    shiftStart,
    shiftEnd: "17:00",
    isActive: true,
  };
}

function earlyAssignment(overrides: Row = {}): Row {
  return {
    id: "overtime-1",
    employeeId: "employee-1",
    periodDate: "2026-08-30",
    assignmentSource: "admin_assignment",
    plannedStartTime: "06:30",
    plannedEndTime: "08:30",
    status: "ot_approved",
    otInTime: null,
    otOutTime: null,
    ...overrides,
  };
}

test("one gate scan atomically starts matched early OT and clocks regular attendance at the planned boundary", async () => {
  const database = new FakeAttendanceOvertimeDatabase();
  database.employees.push({ id: "employee-1", employmentStatus: "active" });
  database.rules.push(
    activeRule("morning-shift", "08:30"),
    activeRule("later-shift", "09:00"),
  );
  database.overtimeLogs.push(earlyAssignment());

  const result = await recordGateClockIn(
    { employeeId: "employee-1" },
    database as any,
    phtTime(8, 0),
  );

  assert.equal(database.transactionCount, 1);
  assert.deepEqual(database.transactionOperations, [
    "update:overtime",
    "insert:attendance",
  ]);
  assert.equal(database.overtimeLogs[0].status, "ot_in_progress");
  assert.equal(database.overtimeLogs[0].otInTime.toISOString(), "2026-08-30T00:00:00.000Z");
  assert.equal(result.attendanceRuleId, "morning-shift");
  assert.ok(result.clockInAt);
  assert.equal(result.clockInAt.toISOString(), "2026-08-30T00:30:00.000Z");
});

test("server reconciliation closes matched early OT at its planned end without a browser", async () => {
  const database = new FakeAttendanceOvertimeDatabase();
  database.rules.push(activeRule("morning-shift", "08:30"));
  database.attendanceLogs.push({
    id: "attendance-1",
    employeeId: "employee-1",
    date: "2026-08-30",
    attendanceRuleId: "morning-shift",
    clockInAt: phtTime(8, 30),
  });
  database.overtimeLogs.push(
    earlyAssignment({
      status: "ot_in_progress",
      otInTime: phtTime(7, 0),
    }),
  );

  await reconcileCompletedEarlyOvertime(phtTime(8, 31), database as any);

  assert.equal(database.overtimeLogs[0].status, "ot_completed_pending_review");
  assert.equal(database.overtimeLogs[0].otOutTime.toISOString(), "2026-08-30T00:30:00.000Z");

  database.overtimeLogs[0].status = "ot_in_progress";
  database.overtimeLogs[0].otOutTime = null;
  await reconcileCompletedEarlyOvertime(phtTime(8, 29), database as any);
  assert.equal(database.overtimeLogs[0].status, "ot_in_progress");
  assert.equal(database.overtimeLogs[0].otOutTime, null);
});

test("early admin assignments reject direct employee clock-in and clock-out", () => {
  const rules = [
    activeRule("morning-shift", "08:30"),
    activeRule("later-shift", "09:00"),
  ];
  const row = earlyAssignment();

  assert.equal(
    getManualOvertimeControlError(row, rules, "clock_in"),
    "Early assigned overtime starts only through the gate QR clock-in",
  );
  assert.equal(
    getManualOvertimeControlError(row, rules, "clock_out"),
    "Early assigned overtime ends automatically at the regular shift start",
  );
});

test("early reconciliation requires exact planned-end and active shift-start matching", async () => {
  assert.equal(isMatchedEarlyOvertime("06:30", "08:30", "08:30"), true);
  assert.equal(isMatchedEarlyOvertime("06:30", "08:30", "09:00"), false);

  const database = new FakeAttendanceOvertimeDatabase();
  database.rules.push(
    activeRule("mismatched-shift", "08:45"),
    activeRule("other-shift", "09:00"),
  );
  database.attendanceLogs.push({
    id: "attendance-1",
    employeeId: "employee-1",
    date: "2026-08-30",
    attendanceRuleId: "mismatched-shift",
    clockInAt: phtTime(8, 45),
  });
  database.overtimeLogs.push(
    earlyAssignment({
      status: "ot_in_progress",
      plannedEndTime: "08:30",
    }),
  );

  await reconcileCompletedEarlyOvertime(phtTime(9, 0), database as any);
  assert.equal(database.overtimeLogs[0].status, "ot_in_progress");
  assert.equal(database.overtimeLogs[0].otOutTime, null);
});

test("evening admin assignments and employee-requested overtime retain manual controls", () => {
  const rules = [activeRule("morning-shift", "08:30")];

  assert.equal(
    getManualOvertimeControlError(
      earlyAssignment({
        plannedStartTime: "18:00",
        plannedEndTime: "20:00",
      }),
      rules,
      "clock_in",
    ),
    null,
  );
  assert.equal(
    getManualOvertimeControlError(
      earlyAssignment({
        assignmentSource: null,
        plannedStartTime: null,
        plannedEndTime: null,
      }),
      rules,
      "clock_out",
    ),
    null,
  );
});
