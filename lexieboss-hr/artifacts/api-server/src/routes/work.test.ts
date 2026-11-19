import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://work-tests.invalid/work";

const {
  appUsersTable,
  employeesTable,
  attendanceSummariesTable,
  workJobsTable,
  workJobDailyCompletionsTable,
  workItemsTable,
  employeeDailyTasksTable,
  employeeDailyTaskCompletionsTable,
} = await import("@workspace/db");
const { createWorkRouter } = await import("./work");

type Row = Record<string, any>;

class FakeWorkDatabase {
  users: Row[] = [{
    id: "user-1",
    replitId: "admin-1",
    role: "admin",
    employeeId: null,
  }];
  employees: Row[] = [];
  tasks: Row[] = [];
  completions: Row[] = [];
  jobCompletions: Row[] = [];
  jobs: Row[] = [];
  items: Row[] = [];
  summaries: Row[] = [];

  select() {
    return new FakeSelectQuery(this);
  }

  update(table: unknown) {
    return new FakeUpdateQuery(this, table);
  }

  insert(table: unknown) {
    return new FakeInsertQuery(this, table);
  }

  transaction<T>(operation: (transaction: this) => Promise<T>) {
    return operation(this);
  }

  rowsFor(table: unknown): Row[] {
    if (table === appUsersTable) return this.users;
    if (table === employeesTable) return this.employees;
    if (table === attendanceSummariesTable) return this.summaries;
    if (table === workJobsTable) return this.jobs;
    if (table === workJobDailyCompletionsTable) return this.jobCompletions;
    if (table === workItemsTable) return this.items;
    if (table === employeeDailyTasksTable) return this.tasks;
    if (table === employeeDailyTaskCompletionsTable) return this.completions;
    throw new Error("Unexpected table in fake query");
  }

  updateRows(table: unknown, values: Row): Row[] {
    const rows = this.rowsFor(table);
    if (rows.length === 0) return [];
    Object.assign(rows[0], values);
    return [rows[0]];
  }

  upsertCompletion(values: Row, updateValues: Row): Row[] {
    const existing = this.completions.find((completion) =>
      completion.taskId === values.taskId &&
      completion.completionDate === values.completionDate,
    );
    if (existing) {
      Object.assign(existing, updateValues);
      return [existing];
    }

    const inserted = {
      ...values,
      id: `completion-${this.completions.length + 1}`,
      createdAt: new Date("2026-08-30T00:00:00.000Z"),
      updatedAt: new Date("2026-08-30T00:00:00.000Z"),
    };
    this.completions.push(inserted);
    return [inserted];
  }

  insertJobCompletion(values: Row): Row[] {
    const existing = this.jobCompletions.find((completion) =>
      completion.jobId === values.jobId &&
      completion.completionDate === values.completionDate,
    );
    if (existing) return [existing];

    const inserted = {
      ...values,
      id: `job-completion-${this.jobCompletions.length + 1}`,
      completedAt: new Date("2026-08-30T00:00:00.000Z"),
    };
    this.jobCompletions.push(inserted);
    return [inserted];
  }
}

class FakeSelectQuery {
  private table: unknown;

  constructor(private readonly database: FakeWorkDatabase) {}

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

  for() {
    return this;
  }

  then(resolve: (value: Row[]) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve(this.database.rowsFor(this.table)).then(resolve, reject);
  }
}

class FakeUpdateQuery {
  private values: Row = {};

  constructor(
    private readonly database: FakeWorkDatabase,
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
    return Promise.resolve(this.database.updateRows(this.table, this.values));
  }
}

class FakeInsertQuery {
  private valuesToInsert: Row = {};
  private conflictUpdate: Row = {};
  private doNothingOnConflict = false;

  constructor(
    private readonly database: FakeWorkDatabase,
    private readonly table: unknown,
  ) {}

  values(values: Row) {
    this.valuesToInsert = values;
    return this;
  }

  onConflictDoUpdate(config: { set: Row }) {
    this.conflictUpdate = config.set;
    return this;
  }

  onConflictDoNothing() {
    this.doNothingOnConflict = true;
    return this;
  }

  returning() {
    if (this.table === employeeDailyTaskCompletionsTable) {
      return Promise.resolve(this.database.upsertCompletion(this.valuesToInsert, this.conflictUpdate));
    }
    if (this.table === workJobDailyCompletionsTable && this.doNothingOnConflict) {
      return Promise.resolve(this.database.insertJobCompletion(this.valuesToInsert));
    }
    throw new Error("Unexpected returning insert in fake query");
  }

  then(resolve: (value: Row[]) => unknown, reject?: (reason: unknown) => unknown) {
    if (this.table === workJobDailyCompletionsTable && this.doNothingOnConflict) {
      return Promise.resolve(this.database.insertJobCompletion(this.valuesToInsert)).then(resolve, reject);
    }
    return this.returning().then(resolve, reject);
  }
}

type ResponseCapture = {
  status: number;
  body: unknown;
};

async function request(
  router: ReturnType<typeof createWorkRouter>,
  method: string,
  path: string,
  body: Row,
  userId = "admin-1",
): Promise<ResponseCapture> {
  return new Promise((resolve, reject) => {
    const req = {
      method,
      url: path,
      originalUrl: path,
      baseUrl: "",
      body,
      user: { id: userId },
      isAuthenticated: () => true,
    } as any;
    const res = {
      statusCode: 200,
      locals: {},
      status(status: number) {
        this.statusCode = status;
        return this;
      },
      json(responseBody: unknown) {
        resolve({ status: this.statusCode, body: responseBody });
        return this;
      },
      send(responseBody: unknown) {
        resolve({ status: this.statusCode, body: responseBody });
        return this;
      },
    } as any;

    (router as any).handle(req, res, (error?: unknown) => {
      if (error) reject(error);
    });
  });
}

function recurringTask(overrides: Row = {}): Row {
  return {
    id: "task-1",
    employeeId: "employee-1",
    taskDate: "2026-08-31",
    repeatDaily: true,
    title: "Review inbox",
    description: "",
    completed: false,
    completedOn: null,
    employeeNote: null,
    createdAt: new Date("2026-08-29T00:00:00.000Z"),
    updatedAt: new Date("2026-08-29T00:00:00.000Z"),
    ...overrides,
  };
}

function assignedJob(overrides: Row = {}): Row {
  return {
    id: "job-1",
    jobId: "JOB-001",
    clientName: "Sample client",
    brief: "",
    priority: "normal",
    status: "ongoing",
    assigneeId: "employee-1",
    startDate: "2026-09-01",
    endDate: "2026-09-10",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

function signInAsEmployee(database: FakeWorkDatabase) {
  database.users[0] = {
    id: "user-employee",
    replitId: "employee-user",
    role: "employee",
    employeeId: "employee-1",
  };
}

test("assigned employee can mark a zero-item job done once per Manila date without changing job status", async () => {
  const database = new FakeWorkDatabase();
  signInAsEmployee(database);
  database.jobs.push(assignedJob({ endDate: "2026-09-02" }));
  let now = new Date("2026-09-01T15:59:00.000Z");
  const router = createWorkRouter(database as any, () => now);

  const firstResponse = await request(router, "POST", "/work/my/jobs/job-1/daily-completion", {}, "employee-user");
  assert.equal(firstResponse.status, 200);
  assert.deepEqual((firstResponse.body as Row).items, []);
  assert.equal((firstResponse.body as Row).dailyCompleted, true);
  assert.equal((firstResponse.body as Row).completionDate, "2026-09-01");
  assert.equal((firstResponse.body as Row).status, "ongoing");
  assert.equal(database.jobs[0].status, "ongoing");
  assert.equal(database.jobCompletions.length, 1);
  assert.equal(database.jobCompletions[0].employeeId, "employee-1");

  now = new Date("2026-09-01T16:00:00.000Z");
  const nextDayState = await request(router, "GET", "/work/my", {}, "employee-user");
  const nextDayJob = ((nextDayState.body as Row).jobs as Row[])[0];
  assert.equal(nextDayJob.dailyCompleted, false);
  assert.equal(nextDayJob.completionDate, "2026-09-02");

  const [secondResponse, duplicateResponse] = await Promise.all([
    request(router, "POST", "/work/my/jobs/job-1/daily-completion", {}, "employee-user"),
    request(router, "POST", "/work/my/jobs/job-1/daily-completion", {}, "employee-user"),
  ]);
  assert.equal(secondResponse.status, 200);
  assert.equal(duplicateResponse.status, 200);
  assert.equal(database.jobCompletions.length, 2);
  assert.deepEqual(
    database.jobCompletions.map((completion) => completion.completionDate).sort(),
    ["2026-09-01", "2026-09-02"],
  );

  database.users[0].role = "admin";
  const listedJobs = await request(router, "GET", "/work/jobs", {});
  const listedJob = ((listedJobs.body as Row[])[0]);
  assert.equal(listedJob.dailyCompleted, true);
  assert.equal(listedJob.completionDate, "2026-09-02");
});

test("only the job assignee can mark it done; an item-only assignee is denied", async () => {
  const database = new FakeWorkDatabase();
  signInAsEmployee(database);
  database.jobs.push(assignedJob({ assigneeId: "employee-2" }));
  database.items.push({
    id: "item-1",
    jobId: "job-1",
    assigneeId: "employee-1",
    status: "not_started",
  });
  const router = createWorkRouter(database as any, () => new Date("2026-09-02T03:00:00.000Z"));

  const response = await request(router, "POST", "/work/my/jobs/job-1/daily-completion", {}, "employee-user");

  assert.equal(response.status, 403);
  assert.equal(database.jobCompletions.length, 0);
});

test("daily completion rejects jobs outside their inclusive date range and already-completed jobs", async () => {
  const database = new FakeWorkDatabase();
  signInAsEmployee(database);
  database.jobs.push(assignedJob({ id: "future-job", startDate: "2026-09-03", endDate: "2026-09-05" }));
  const router = createWorkRouter(database as any, () => new Date("2026-09-02T03:00:00.000Z"));

  const outOfRange = await request(router, "POST", "/work/my/jobs/future-job/daily-completion", {}, "employee-user");
  assert.equal(outOfRange.status, 400);

  const completedDatabase = new FakeWorkDatabase();
  signInAsEmployee(completedDatabase);
  completedDatabase.jobs.push(assignedJob({ id: "completed-job", status: "completed" }));
  const completedRouter = createWorkRouter(completedDatabase as any, () => new Date("2026-09-02T03:00:00.000Z"));
  const completed = await request(completedRouter, "POST", "/work/my/jobs/completed-job/daily-completion", {}, "employee-user");
  assert.equal(completed.status, 409);
  assert.equal(completedDatabase.jobCompletions.length, 0);
});

test("admin job history returns every scheduled day through the earlier of today and endDate", async () => {
  const database = new FakeWorkDatabase();
  database.jobs.push(assignedJob({ startDate: "2026-08-31", endDate: "2026-09-04" }));
  database.jobCompletions.push({
    id: "completion-1",
    jobId: "job-1",
    employeeId: "employee-1",
    completionDate: "2026-09-01",
    completedAt: new Date("2026-09-01T03:00:00.000Z"),
  });
  const router = createWorkRouter(database as any, () => new Date("2026-09-02T03:00:00.000Z"));

  const response = await request(router, "GET", "/work/jobs/job-1/history", {});

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, [
    { date: "2026-09-02", completed: false },
    { date: "2026-09-01", completed: true },
    { date: "2026-08-31", completed: false },
  ]);

  signInAsEmployee(database);
  const forbidden = await request(router, "GET", "/work/jobs/job-1/history", {}, "employee-user");
  assert.equal(forbidden.status, 403);
});

test("admin job history excludes dates after an earlier job end date", async () => {
  const database = new FakeWorkDatabase();
  database.jobs.push(assignedJob({ startDate: "2026-08-31", endDate: "2026-09-01" }));
  const router = createWorkRouter(database as any, () => new Date("2026-09-02T03:00:00.000Z"));

  const response = await request(router, "GET", "/work/jobs/job-1/history", {});

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, [
    { date: "2026-09-01", completed: false },
    { date: "2026-08-31", completed: false },
  ]);
});

test("employee can mark their assigned job completed", async () => {
  const database = new FakeWorkDatabase();
  database.users[0] = {
    id: "user-employee",
    replitId: "employee-user",
    role: "employee",
    employeeId: "employee-1",
  };
  database.jobs.push(assignedJob());
  const router = createWorkRouter(database as any);

  const response = await request(router, "POST", "/work/my/jobs/job-1/complete", {}, "employee-user");

  assert.equal(response.status, 200);
  assert.equal((response.body as Row).status, "completed");
  assert.equal(database.jobs[0].status, "completed");
});

test("employee cannot complete a job assigned to another employee", async () => {
  const database = new FakeWorkDatabase();
  database.users[0] = {
    id: "user-employee",
    replitId: "employee-user",
    role: "employee",
    employeeId: "employee-1",
  };
  database.jobs.push(assignedJob({ assigneeId: "employee-2" }));
  const router = createWorkRouter(database as any);

  const response = await request(router, "POST", "/work/my/jobs/job-1/complete", {}, "employee-user");

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, { error: "You can only complete jobs assigned to you" });
  assert.equal(database.jobs[0].status, "ongoing");
});

test("repeated completion toggles leave one final history row for the Manila date", async () => {
  const database = new FakeWorkDatabase();
  database.tasks.push(recurringTask());
  const router = createWorkRouter(database as any, () => new Date("2026-08-31T03:00:00.000Z"));

  await request(router, "PATCH", "/work/tasks/task-1", { completed: true });
  await request(router, "PATCH", "/work/tasks/task-1", { completed: false });

  assert.equal(database.completions.length, 1);
  assert.equal(database.completions[0].taskId, "task-1");
  assert.equal(database.completions[0].completionDate, "2026-08-31");
  assert.equal(database.completions[0].completed, false);
  assert.equal(database.tasks[0].completedOn, null);
});

test("completion just after the UTC day boundary uses the Manila calendar date", async () => {
  const database = new FakeWorkDatabase();
  database.tasks.push(recurringTask({ taskDate: "2026-08-30" }));
  const router = createWorkRouter(database as any, () => new Date("2026-08-30T16:05:00.000Z"));

  await request(router, "PATCH", "/work/tasks/task-1", { completed: true });

  assert.equal(database.completions.length, 1);
  assert.equal(database.completions[0].completionDate, "2026-08-31");
  assert.equal(database.tasks[0].completedOn, "2026-08-31");
});

test("admin history returns completed and not-completed days from the task start through today", async () => {
  const database = new FakeWorkDatabase();
  database.tasks.push(recurringTask({ taskDate: "2026-08-28" }));
  database.completions.push(
    {
      id: "completion-1",
      taskId: "task-1",
      completionDate: "2026-08-28",
      completed: true,
      createdAt: new Date("2026-08-28T01:00:00.000Z"),
      updatedAt: new Date("2026-08-28T01:00:00.000Z"),
    },
    {
      id: "completion-2",
      taskId: "task-1",
      completionDate: "2026-08-29",
      completed: false,
      createdAt: new Date("2026-08-29T01:00:00.000Z"),
      updatedAt: new Date("2026-08-29T01:00:00.000Z"),
    },
    {
      id: "completion-3",
      taskId: "task-1",
      completionDate: "2026-08-31",
      completed: true,
      createdAt: new Date("2026-08-31T01:00:00.000Z"),
      updatedAt: new Date("2026-08-31T01:00:00.000Z"),
    },
  );
  const router = createWorkRouter(database as any, () => new Date("2026-08-31T03:00:00.000Z"));

  const response = await request(router, "GET", "/work/tasks/task-1/history", {});

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, [
    { date: "2026-08-31", completed: true },
    { date: "2026-08-30", completed: false },
    { date: "2026-08-29", completed: false },
    { date: "2026-08-28", completed: true },
  ]);
});

test("weekly recap counts task completion, missed recurring days, job progress, and attendance", async () => {
  const database = new FakeWorkDatabase();
  database.users[0] = {
    id: "user-employee",
    replitId: "employee-user",
    role: "employee",
    employeeId: "employee-1",
  };
  database.tasks.push(
    {
      ...recurringTask({ id: "task-1", taskDate: "2026-08-31" }),
      completed: true,
      completedOn: "2026-09-02",
    },
    {
      ...recurringTask({ id: "task-2", taskDate: "2026-09-01", repeatDaily: false, title: "Submit report" }),
      completed: false,
      completedOn: null,
    },
    {
      ...recurringTask({ id: "task-3", taskDate: "2026-09-02", repeatDaily: false, title: "Attend briefing" }),
      completed: true,
      completedOn: null,
    },
  );
  database.completions.push(
    {
      id: "completion-1",
      taskId: "task-1",
      completionDate: "2026-08-31",
      completed: true,
    },
    {
      id: "completion-2",
      taskId: "task-1",
      completionDate: "2026-09-01",
      completed: false,
    },
    {
      id: "completion-3",
      taskId: "task-1",
      completionDate: "2026-09-02",
      completed: true,
    },
  );
  database.items.push(
    { id: "item-1", assigneeId: "employee-1", status: "done" },
    { id: "item-2", assigneeId: "employee-1", status: "blocked" },
  );
  database.summaries.push(
    {
      employeeId: "employee-1",
      date: "2026-08-31",
      status: "present",
      isLate: false,
      lateMinutes: 0,
      lateDeductionAmount: "0.00",
      regularHours: "8.00",
      undertimeMinutes: 0,
      undertimeDeductionAmount: "0.00",
    },
    {
      employeeId: "employee-1",
      date: "2026-09-01",
      status: "late",
      isLate: true,
      lateMinutes: 10,
      lateDeductionAmount: "25.00",
      regularHours: "8.00",
      undertimeMinutes: 0,
      undertimeDeductionAmount: "0.00",
    },
  );
  const router = createWorkRouter(database as any, () => new Date("2026-09-02T03:00:00.000Z"));

  const response = await request(router, "GET", "/work/my/weekly-recap", {}, "employee-user");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    periodFrom: "2026-08-31",
    periodTo: "2026-09-02",
    tasks: { plannedCount: 5, completedCount: 3, missedCount: 2, openCount: 0 },
    jobs: { totalCount: 2, doneCount: 1, inProgressCount: 0, blockedCount: 1, notStartedCount: 0 },
    attendance: {
      employeeId: "employee-1",
      periodFrom: "2026-08-31",
      periodTo: "2026-09-02",
      presentCount: 2,
      lateCount: 1,
      totalLateMinutes: 10,
      totalLateDeductions: "25.00",
      totalHours: "16.00",
      undertimeCount: 0,
      totalUndertimeMinutes: 0,
      totalUndertimeDeductions: "0.00",
    },
  });
});