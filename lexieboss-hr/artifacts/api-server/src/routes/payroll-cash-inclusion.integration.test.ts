import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";

test("direct advance inclusion is atomic, preserves incentives and becomes collected only when payroll is paid", {
  skip: process.env.RUN_PAYROLL_DB_TESTS !== "1",
}, async () => {
  const { db, pool, appUsersTable, employeesTable, payrollPeriodsTable, payrollEntriesTable, cashAdvancesTable } = await import("@workspace/db");
  const { eq, inArray } = await import("drizzle-orm");
  const { default: payrollRouter, generatePayrollEntries } = await import("./payroll");
  const { default: cashRouter } = await import("./cash-advances");
  const { GetPayrollPeriodResponse, ListCashAdvancesResponse } = await import("@workspace/api-zod");
  const actor = `cash-inclusion-${randomUUID()}`;
  const [employeeId, otherEmployeeId, periodId, competingPeriodId, advanceId, extraId, futureId, raceId] = Array.from({ length: 8 }, () => randomUUID());
  const periods: string[] = [periodId, competingPeriodId];
  const advances = [advanceId, extraId, futureId, raceId];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.isAuthenticated = (() => req.headers["x-test-auth"] !== "none") as typeof req.isAuthenticated;
    req.user = { id: actor } as Express.User;
    next();
  });
  app.use("/api", payrollRouter, cashRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api`;
  const include = (advance = advanceId, period = periodId, headers = {}) => fetch(`${base}/payroll/periods/${period}/cash-advances/${advance}`, { method: "POST", headers });
  const payroll = async (period = periodId) => GetPayrollPeriodResponse.parse(await (await fetch(`${base}/payroll/periods/${period}`)).json());
  const cashList = async () => ListCashAdvancesResponse.parse(await (await fetch(`${base}/cash-advances`)).json());
  try {
    await db.insert(appUsersTable).values({ replitId: actor, role: "admin" });
    await db.insert(employeesTable).values([employeeId, otherEmployeeId].map((id) => ({
      id, employeeCode: `cash-test-${id}`, firstName: "Synthetic", lastName: "Cash Inclusion",
      mobileNumber: "", address: "", hireDate: "2026-01-01", dailyRate: "800",
      sssNumber: "", philhealthNumber: "", pagibigNumber: "",
    })));
    await db.insert(payrollPeriodsTable).values(periods.map((id) => ({
      id, startDate: "2026-11-01", endDate: "2026-11-15", generatedAt: new Date(), status: "approved" as const, approvedAt: new Date(),
    })));
    await db.insert(payrollEntriesTable).values(periods.map((payrollPeriodId) => ({
      payrollPeriodId, employeeId, dailyRateSnapshot: "800", regularPay: "8000", lateDeductionTotal: "24",
      incentivePay: "1600", grossPay: "9600", netPay: "9576",
    })));
    await db.insert(cashAdvancesTable).values([
      { id: advanceId, employeeId, amount: "2500", advanceDate: "2026-11-14", deductionDate: "2026-11-14" },
      { id: extraId, employeeId, amount: "100", advanceDate: "2026-11-14", deductionDate: "2026-11-14" },
      { id: futureId, employeeId, amount: "100", advanceDate: "2026-11-14", deductionDate: "2026-12-01" },
      { id: raceId, employeeId, amount: "200", advanceDate: "2026-11-14", deductionDate: "2026-11-14" },
    ]);
    assert.equal((await include(advanceId, periodId, { "x-test-auth": "none" })).status, 401);
    await db.update(appUsersTable).set({ role: "employee" }).where(eq(appUsersTable.replitId, actor));
    assert.equal((await include()).status, 403);
    await db.update(appUsersTable).set({ role: "admin" }).where(eq(appUsersTable.replitId, actor));
    assert.equal((await include(randomUUID())).status, 404);
    assert.equal((await include(futureId)).status, 400);
    // Same-task duplicate requests must only deduct once.
    const requests = await Promise.all([include(), include()]);
    assert.deepEqual(requests.map((response) => response.status), [200, 200]);
    let result = await payroll();
    assert.equal(result.period.status, "draft");
    assert.equal(result.period.approvedAt, null);
    assert.equal(result.entries[0].entry.cashAdvanceDeduction, "2500.00");
    assert.equal(result.entries[0].entry.incentivePay, "1600.00");
    assert.equal(result.entries[0].entry.regularPay, "8000.00");
    assert.equal(result.entries[0].entry.netPay, "7076.00");
    assert.equal((await cashList()).find((advance) => advance.id === advanceId)?.payrollStatus, "draft");
    assert.equal((await include(advanceId, competingPeriodId)).status, 409);
    assert.equal((await include(extraId)).status, 200);
    result = await payroll();
    assert.equal(result.entries[0].entry.cashAdvanceDeduction, "2600.00");
    assert.equal(result.entries[0].entry.netPay, "6976.00");

    // Competing direct inclusion and normal generation cannot claim the same advance.
    await Promise.allSettled([
      include(raceId),
      generatePayrollEntries(competingPeriodId, "2026-11-01", "2026-11-15", [employeeId], db, [raceId]),
    ]);
    const [raceAdvance] = await db.select().from(cashAdvancesTable).where(eq(cashAdvancesTable.id, raceId));
    const first = await payroll();
    const second = await payroll(competingPeriodId);
    assert.ok(periods.includes(raceAdvance.deductedPayrollPeriodId!));
    assert.equal(
      Number(first.entries[0].entry.cashAdvanceDeduction) + Number(second.entries[0].entry.cashAdvanceDeduction),
      2800,
    );
    // A pending advance for an employee without a generated entry must not be attached.
    await db.update(cashAdvancesTable).set({ employeeId: otherEmployeeId, deductionDate: "2026-11-14" }).where(eq(cashAdvancesTable.id, futureId));
    assert.equal((await include(futureId)).status, 404);
    await db.update(payrollPeriodsTable).set({ status: "approved", approvedAt: new Date() }).where(eq(payrollPeriodsTable.id, periodId));
    const paid = await fetch(`${base}/payroll/periods/${periodId}/mark-paid`, { method: "PATCH" });
    assert.equal(paid.status, 200);
    assert.equal((await cashList()).find((advance) => advance.id === advanceId)?.payrollStatus, "paid");
    assert.equal((await include(extraId)).status, 400);
    assert.equal((await include(futureId)).status, 400);
  } finally {
    await db.delete(cashAdvancesTable).where(inArray(cashAdvancesTable.id, advances));
    await db.delete(payrollPeriodsTable).where(inArray(payrollPeriodsTable.id, periods));
    await db.delete(appUsersTable).where(eq(appUsersTable.replitId, actor));
    await db.delete(employeesTable).where(inArray(employeesTable.id, [employeeId, otherEmployeeId]));
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  }
});
