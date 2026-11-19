import { test } from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgresql://work-tests.invalid/work";
const { appUsersTable, employeesTable, workActivityLogsTable } = await import("@workspace/db");
const { createWorkActivityRouter } = await import("./work-activity");
type Row = Record<string, any>;
const dialect = new PgDialect();

// Apply the actual equality predicates, including employee ownership in updates/deletes.
function matches(row: Row, condition?: SQL) {
  if (!condition) return true;
  const { sql, params } = dialect.sqlToQuery(condition);
  const predicates = [...sql.matchAll(/"[^"]+"\."([^"]+)" = \$(\d+)/g)];
  return predicates.every(([, column, parameter]) => {
    const property = column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    return row[property] === params[Number(parameter) - 1];
  });
}

class FakeActivityDatabase {
  users: Row[] = [
    { id: "u-1", replitId: "employee-auth", role: "employee", employeeId: "employee-1" },
    { id: "u-2", replitId: "other-auth", role: "employee", employeeId: "employee-2" },
    { id: "u-admin", replitId: "admin-auth", role: "admin", employeeId: null },
  ];
  employees: Row[] = [
    { id: "employee-1", employeeCode: "TEST1", firstName: "Test", lastName: "One" },
    { id: "employee-2", employeeCode: "TEST2", firstName: "Test", lastName: "Two" },
  ];
  logs: Row[] = [];
  sequence = 0;
  rows(table: unknown) {
    if (table === appUsersTable) return this.users;
    if (table === employeesTable) return this.employees;
    if (table === workActivityLogsTable) return this.logs;
    throw new Error("Unexpected table");
  }
  select() { return new FakeQuery(this, "select"); }
  insert(table: unknown) { return new FakeQuery(this, "insert", table); }
  update(table: unknown) { return new FakeQuery(this, "update", table); }
  delete(table: unknown) { return new FakeQuery(this, "delete", table); }
}

class FakeQuery {
  condition?: SQL;
  data: Row = {};
  max = Infinity;
  sorted = false;
  constructor(private store: FakeActivityDatabase, private action: string, private table?: unknown) {}
  from(table: unknown) { this.table = table; return this; }
  where(condition: SQL) { this.condition = condition; return this; }
  orderBy() { this.sorted = true; return this; }
  limit(value: number) { this.max = value; return this; }
  values(data: Row) { this.data = data; return this; }
  set(data: Row) { this.data = data; return this; }
  returning() { return this; }
  then(resolve: (rows: Row[]) => unknown, reject?: (error: unknown) => unknown) {
    try {
      let rows = this.store.rows(this.table);
      if (this.action === "insert") {
        const date = new Date("2026-10-01T16:01:00Z");
        const row = { id: `log-${++this.store.sequence}`, createdAt: date, updatedAt: date, ...this.data };
        rows.push(row);
        return Promise.resolve([row]).then(resolve, reject);
      }
      const selected = rows.filter((row) => matches(row, this.condition));
      if (this.action === "update") selected.forEach((row) => Object.assign(row, this.data));
      if (this.action === "delete") {
        this.store.logs = rows.filter((row) => !selected.includes(row));
      }
      rows = selected;
      if (this.sorted) rows = [...rows].sort((a, b) => b.activityDate.localeCompare(a.activityDate));
      return Promise.resolve(rows.slice(0, this.max)).then(resolve, reject);
    } catch (error) {
      return Promise.reject(error).then(resolve, reject);
    }
  }
}

async function request(
  router: ReturnType<typeof createWorkActivityRouter>, method: string, path: string,
  body: Row = {}, userId: string | null = "employee-auth",
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = {
      method, url: path, originalUrl: path, baseUrl: "", body,
      query: Object.fromEntries(new URL(path, "http://test.invalid").searchParams),
      user: userId ? { id: userId } : undefined, isAuthenticated: () => userId !== null,
    };
    const res = {
      statusCode: 200, locals: {},
      status(status: number) { this.statusCode = status; return this; },
      json(body: unknown) { resolve({ status: this.statusCode, body }); return this; },
      send(body: unknown) { resolve({ status: this.statusCode, body }); return this; },
    };
    (router as any).handle(req, res, (error?: unknown) => reject(error ?? new Error("Route did not respond")));
  });
}

const input = { activityDate: "2026-10-02", kind: "accomplishment", title: "Prepared client update", details: "Sent the revised artwork." };
function setup() {
  const store = new FakeActivityDatabase();
  const router = createWorkActivityRouter(store as any, () => new Date("2026-10-01T16:01:00Z"));
  return { store, router };
}

test("employee can save an unassigned accomplishment and list it with server-owned identity", async () => {
  const { store, router } = setup();
  const saved = await request(router, "POST", "/work/my/activity-logs", {
    ...input, employeeId: "employee-2", id: "forged", title: `  ${input.title}  `,
  });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.employeeId, "employee-1");
  assert.notEqual(saved.body.id, "forged");
  assert.equal(saved.body.title, input.title);
  assert.equal(saved.body.activityDate, "2026-10-02");
  assert.equal(saved.body.employee.employeeCode, "TEST1");
  assert.equal(store.logs.length, 1);
  const listed = await request(router, "GET", "/work/my/activity-logs");
  assert.equal(listed.body.length, 1);
  assert.equal(listed.body[0].details, input.details);
});

test("work logs validate calendar dates against Manila today and reject empty or oversized fields", async () => {
  const { store, router } = setup();
  for (const patch of [
    { activityDate: "2026-10-03" }, { activityDate: "2026-02-30" },
    { activityDate: "not-a-date" }, { activityDate: "2026-10-02T00:00:00Z" },
    { title: "  " }, { title: "x".repeat(201) }, { details: "x".repeat(2001) }, { kind: "other" },
  ]) {
    const result = await request(router, "POST", "/work/my/activity-logs", { ...input, ...patch });
    assert.equal(result.status, 400, JSON.stringify(patch));
  }
  assert.equal(store.logs.length, 0);
  const event = await request(router, "POST", "/work/my/activity-logs", { ...input, activityDate: "2026-09-30", kind: "event", details: "" });
  assert.equal(event.status, 201);
});

test("employee lists are private while admin review includes named employee entries", async () => {
  const { router } = setup();
  await request(router, "POST", "/work/my/activity-logs", input);
  await request(router, "POST", "/work/my/activity-logs", { ...input, title: "Other employee's event", kind: "event" }, "other-auth");
  const personal = await request(router, "GET", "/work/my/activity-logs");
  assert.equal(personal.body.length, 1);
  assert.equal(personal.body[0].employeeId, "employee-1");
  assert.equal((await request(router, "GET", "/work/activity-logs")).status, 403);
  const admin = await request(router, "GET", "/work/activity-logs", {}, "admin-auth");
  assert.equal(admin.status, 200);
  assert.equal(admin.body.length, 2);
  assert.ok(admin.body.every((log: Row) => log.employee?.employeeCode));
});

test("employee can correct and delete only their own entry; unrelated fields stay intact", async () => {
  const { router } = setup();
  const saved = await request(router, "POST", "/work/my/activity-logs", input);
  const path = `/work/my/activity-logs/${saved.body.id}`;
  assert.equal((await request(router, "PATCH", path, { title: "Stolen" }, "other-auth")).status, 404);
  assert.equal((await request(router, "DELETE", path, {}, "other-auth")).status, 404);
  assert.equal((await request(router, "PATCH", path, {})).status, 400);
  const edited = await request(router, "PATCH", path, { details: "", employeeId: "employee-2" });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.title, input.title);
  assert.equal(edited.body.kind, input.kind);
  assert.equal(edited.body.details, "");
  assert.equal(edited.body.employeeId, "employee-1");
  assert.equal((await request(router, "PATCH", path, { activityDate: "2026-10-03" })).status, 400);
  assert.equal((await request(router, "DELETE", path)).status, 204);
  assert.equal((await request(router, "GET", "/work/my/activity-logs")).body.length, 0);
  assert.equal((await request(router, "DELETE", path)).status, 404);
});

test("admin employee filter applies before the report limit and rejects invalid filters", async () => {
  const { store, router } = setup();
  await request(router, "POST", "/work/my/activity-logs", input);
  for (let index = 0; index < 205; index++) {
    await request(router, "POST", "/work/my/activity-logs", { ...input, title: `Other report ${index}` }, "other-auth");
  }
  const filtered = await request(router, "GET", "/work/activity-logs?employeeId=employee-1", {}, "admin-auth");
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.length, 1);
  assert.equal(filtered.body[0].employeeId, "employee-1");
  const other = await request(router, "GET", "/work/activity-logs?employeeId=employee-2", {}, "admin-auth");
  assert.equal(other.body.length, 200);
  assert.ok(other.body.every((log: Row) => log.employeeId === "employee-2"));
  assert.equal((await request(router, "GET", "/work/activity-logs", {}, "admin-auth")).body.length, 200);
  assert.equal((await request(router, "GET", "/work/activity-logs?employeeId=missing", {}, "admin-auth")).body.length, 0);
  assert.equal((await request(router, "GET", "/work/activity-logs?employeeId=", {}, "admin-auth")).status, 400);
  assert.equal((await request(router, "GET", "/work/activity-logs?employeeId=employee-1")).status, 403);
  assert.equal(store.logs.length, 206);
});

test("manual work logs require a linked employee session and restrict admin review", async () => {
  const { router } = setup();
  assert.equal((await request(router, "POST", "/work/my/activity-logs", input, null)).status, 401);
  assert.equal((await request(router, "GET", "/work/my/activity-logs", {}, "unknown-auth")).status, 401);
  assert.equal((await request(router, "POST", "/work/my/activity-logs", input, "admin-auth")).status, 403);
  assert.equal((await request(router, "GET", "/work/activity-logs", {}, null)).status, 401);
});