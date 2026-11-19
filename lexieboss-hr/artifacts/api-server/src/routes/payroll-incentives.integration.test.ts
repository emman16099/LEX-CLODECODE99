import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";

// Opt in: creates and removes only uniquely named synthetic development records.
test("incentive API persists edits, withdraws approval, survives generation and rejects paid edits", {
  skip: process.env.RUN_PAYROLL_DB_TESTS !== "1",
}, async () => {
  const { db, pool, appUsersTable, employeesTable, payrollPeriodsTable, payrollEntriesTable, payrollIncentivesTable, payrollIncentiveChangesTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const { GetPayrollPeriodResponse, ListPayrollIncentiveChangesResponse } = await import("@workspace/api-zod");
  const { savePayrollIncentive } = await import("../lib/payroll-incentives");
  const { default: payrollRouter, generatePayrollEntries } = await import("./payroll");
  const id = randomUUID();
  const employeeId = randomUUID();
  const actor = `payroll-incentive-test-${randomUUID()}`;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.isAuthenticated = (() => req.headers["x-test-auth"] !== "none") as typeof req.isAuthenticated;
    req.user = { id: actor } as Express.User;
    next();
  });
  app.use("/api", payrollRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}/api/payroll/periods/${id}`;
  const patch = (body: unknown, headers = {}) => fetch(`${url}/incentives/${employeeId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
  });
  const input = { weeklyAmount: "800", weeks: 2, note: "Synthetic incentive" };
  const historyUrl = `${url}/incentives/${employeeId}/history`;
  const history = async () => {
    const response = await fetch(historyUrl);
    assert.equal(response.status, 200);
    return ListPayrollIncentiveChangesResponse.parse(await response.json());
  };
  try {
    const [editor] = await db.insert(appUsersTable).values({ replitId: actor, replitUsername: "Synthetic Admin", role: "admin" }).returning();
    await db.insert(employeesTable).values({
      id: employeeId, employeeCode: actor, firstName: "Synthetic", lastName: "Payroll Test",
      mobileNumber: "", address: "", hireDate: "2026-01-01", dailyRate: "800",
      sssNumber: "", philhealthNumber: "", pagibigNumber: "",
    });
    await db.insert(payrollPeriodsTable).values({ id, startDate: "2026-11-01", endDate: "2026-11-15", status: "approved", approvedAt: new Date(), generatedAt: new Date() });
    await db.insert(payrollEntriesTable).values({
      payrollPeriodId: id, employeeId, dailyRateSnapshot: "800", regularPay: "8000",
      lateDeductionTotal: "24", cashAdvanceDeduction: "2500", grossPay: "8000", netPay: "5476",
    });
    assert.equal((await patch(input, { "x-test-auth": "none" })).status, 401);
    assert.equal((await fetch(historyUrl, { headers: { "x-test-auth": "none" } })).status, 401);
    await db.update(appUsersTable).set({ role: "employee" }).where(eq(appUsersTable.replitId, actor));
    assert.equal((await patch(input)).status, 403);
    assert.equal((await fetch(historyUrl)).status, 403);
    await db.update(appUsersTable).set({ role: "admin" }).where(eq(appUsersTable.replitId, actor));
    for (const invalid of [{ ...input, weeks: 0 }, { ...input, weeklyAmount: "-1" }, { ...input, weeks: 1.5 }]) {
      assert.equal((await patch(invalid)).status, 400);
    }
    assert.deepEqual(await history(), []);
    // An audit failure must not save an incentive or withdraw the existing approval.
    await assert.rejects(savePayrollIncentive(id, employeeId, input, { id: null as unknown as string, name: "Invalid editor" }));
    const [unchanged] = await db.select().from(payrollPeriodsTable).where(eq(payrollPeriodsTable.id, id));
    assert.equal(unchanged.status, "approved");
    assert.ok(unchanged.approvedAt);
    assert.deepEqual(await history(), []);
    assert.deepEqual(await db.select().from(payrollIncentivesTable).where(eq(payrollIncentivesTable.payrollPeriodId, id)), []);
    const result = await patch(input);
    assert.equal(result.status, 200);
    const data = GetPayrollPeriodResponse.parse(await result.json());
    assert.equal(data.period.status, "draft");
    assert.equal(data.period.approvedAt, null);
    assert.equal(data.entries[0].entry.incentivePay, "1600.00");
    assert.equal(data.entries[0].entry.netPay, "7076.00");
    let changes = await history();
    assert.equal(changes.length, 1);
    assert.equal(changes[0].previousWeeklyAmount, null);
    assert.equal(changes[0].previousWeeks, null);
    assert.equal(changes[0].previousNote, null);
    assert.equal(changes[0].newWeeklyAmount, "800.00");
    assert.equal(changes[0].newWeeks, 2);
    assert.equal(changes[0].newNote, input.note);
    assert.equal(changes[0].editedBy, editor.id);
    assert.equal(changes[0].editedByName, "Synthetic Admin");
    assert.ok(Number.isFinite(new Date(changes[0].createdAt).getTime()));
    assert.deepEqual(await (await fetch(`${url}/incentives/${randomUUID()}/history`)).json(), []);
    assert.deepEqual(await (await fetch(historyUrl.replace(id, randomUUID()))).json(), []);
    const reloaded = GetPayrollPeriodResponse.parse(await (await fetch(url)).json());
    assert.equal(reloaded.incentives?.[0].weeklyAmount, "800.00");
    assert.equal(reloaded.incentives?.[0].weeks, 2);
    // Regeneration replaces the snapshot but retains its independently stored incentive.
    await generatePayrollEntries(id, "2026-11-01", "2026-11-15", [employeeId], db, []);
    const regenerated = GetPayrollPeriodResponse.parse(await (await fetch(url)).json());
    assert.equal(regenerated.entries[0].entry.incentivePay, "1600.00");
    assert.equal(regenerated.incentives?.[0].weeks, 2);
    assert.equal((await history()).length, 1);
    // Note-only edits are changes too; identities are snapshots, not live account joins.
    assert.equal((await patch({ ...input, note: "Corrected note", editedBy: "forged", editedByName: "forged" })).status, 200);
    await db.update(appUsersTable).set({ replitUsername: "Renamed Admin" }).where(eq(appUsersTable.id, editor.id));
    changes = await history();
    assert.equal(changes[0].previousNote, input.note);
    assert.equal(changes[0].newNote, "Corrected note");
    assert.equal(changes[0].editedByName, "Synthetic Admin");
    assert.equal(changes[0].editedBy, editor.id);
    // Both edits must be retained, and the later edit must read the earlier committed value.
    const responses = await Promise.all([
      patch({ weeklyAmount: "900", weeks: 3, note: "Concurrent A" }),
      patch({ weeklyAmount: "1000", weeks: 4, note: "Concurrent B" }),
    ]);
    assert.deepEqual(responses.map((response) => response.status), [200, 200]);
    changes = await history();
    assert.equal(changes.length, 4);
    assert.equal(changes[0].previousWeeklyAmount, changes[1].newWeeklyAmount);
    assert.equal(changes[0].previousWeeks, changes[1].newWeeks);
    assert.equal(changes[0].previousNote, changes[1].newNote);
    assert.equal(changes[1].previousWeeklyAmount, "800.00");
    assert.equal(changes[1].previousWeeks, 2);
    assert.equal(changes[1].previousNote, "Corrected note");
    assert.equal(changes[0].editedByName, "Renamed Admin");
    assert.equal((await patch({ weeklyAmount: "0", weeks: 1, note: "" })).status, 200);
    const removed = GetPayrollPeriodResponse.parse(await (await fetch(url)).json());
    assert.equal(removed.entries[0].entry.incentivePay, "0.00");
    const beforeRemoval = changes[0];
    changes = await history();
    assert.equal(changes[0].previousWeeklyAmount, beforeRemoval.newWeeklyAmount);
    assert.equal(changes[0].previousWeeks, beforeRemoval.newWeeks);
    assert.equal(changes[0].previousNote, beforeRemoval.newNote);
    assert.equal(changes[0].newWeeklyAmount, "0.00");
    assert.equal(changes[0].newWeeks, 1);
    assert.equal(changes[0].newNote, "");
    // Fail after the audit/source writes to verify the entire transaction rolls back.
    const failureTrigger = `incentive_fail_${randomUUID().replaceAll("-", "")}`;
    try {
      await pool.query(`CREATE FUNCTION ${failureTrigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.employee_id = '${employeeId}' THEN RAISE EXCEPTION 'Synthetic payroll entry failure'; END IF;
        RETURN NEW; END $$`);
      await pool.query(`CREATE TRIGGER ${failureTrigger} BEFORE UPDATE ON payroll_entries FOR EACH ROW EXECUTE FUNCTION ${failureTrigger}()`);
      await assert.rejects(savePayrollIncentive(id, employeeId, input, { id: editor.id, name: "Synthetic Admin" }));
      assert.equal((await history()).length, changes.length);
      const [rolledBack] = await db.select().from(payrollIncentivesTable).where(eq(payrollIncentivesTable.payrollPeriodId, id));
      assert.equal(rolledBack.weeklyAmount, "0.00");
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${failureTrigger} ON payroll_entries`);
      await pool.query(`DROP FUNCTION IF EXISTS ${failureTrigger}()`);
    }
    await db.update(payrollPeriodsTable).set({ status: "paid", paidAt: new Date() }).where(eq(payrollPeriodsTable.id, id));
    assert.equal((await patch(input)).status, 400);
    const [source] = await db.select().from(payrollIncentivesTable).where(eq(payrollIncentivesTable.payrollPeriodId, id));
    assert.equal(source.weeklyAmount, "0.00");
    assert.equal((await history()).length, changes.length);
    assert.equal((await db.select().from(payrollIncentiveChangesTable).where(eq(payrollIncentiveChangesTable.payrollPeriodId, id))).length, 5);
  } finally {
    await db.delete(payrollPeriodsTable).where(eq(payrollPeriodsTable.id, id));
    await db.delete(appUsersTable).where(eq(appUsersTable.replitId, actor));
    await db.delete(employeesTable).where(eq(employeesTable.id, employeeId));
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  }
});
