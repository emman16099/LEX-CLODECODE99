import { and, eq, isNull } from "drizzle-orm";
import { db, cashAdvancesTable, payrollEntriesTable, payrollPeriodsTable } from "@workspace/db";
import { totalsWithIncentive } from "./payroll-incentives";

export class PayrollAdvanceError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function includePayrollAdvance(periodId: string, advanceId: string) {
  await db.transaction(async (tx) => {
    // Lock before reading financial snapshots; generation and approval use the same row.
    const [period] = await tx.update(payrollPeriodsTable).set({ updatedAt: new Date() })
      .where(eq(payrollPeriodsTable.id, periodId)).returning();
    if (!period) throw new PayrollAdvanceError("Payroll period not found", 404);
    if (period.status === "paid") throw new PayrollAdvanceError("Paid payroll cannot be changed", 400);

    const [advance] = await tx.select().from(cashAdvancesTable).where(eq(cashAdvancesTable.id, advanceId)).for("update");
    if (!advance) throw new PayrollAdvanceError("Cash advance not found", 404);
    if (advance.deductedPayrollPeriodId === periodId) return; // Safe retry, no double deduction.
    if (advance.deductedPayrollPeriodId) throw new PayrollAdvanceError("This advance is already included in another payroll", 409);
    if ((advance.deductionDate ?? advance.advanceDate) > period.endDate) {
      throw new PayrollAdvanceError("This advance is scheduled after this payroll period", 400);
    }
    const [entry] = await tx.select().from(payrollEntriesTable).where(and(
      eq(payrollEntriesTable.payrollPeriodId, periodId),
      eq(payrollEntriesTable.employeeId, advance.employeeId),
    ));
    if (!entry) throw new PayrollAdvanceError("Generate payroll for this employee first", 404);

    // Competing payrolls must atomically claim the advance, not overwrite its assignment.
    const [claimed] = await tx.update(cashAdvancesTable)
      .set({ deductedPayrollPeriodId: periodId })
      .where(and(eq(cashAdvancesTable.id, advanceId), isNull(cashAdvancesTable.deductedPayrollPeriodId)))
      .returning();
    if (!claimed) throw new PayrollAdvanceError("This advance was just included in another payroll; refresh and try again", 409);

    const cashAdvanceDeduction = (Number(entry.cashAdvanceDeduction) + Number(claimed.amount)).toFixed(2);
    const totals = totalsWithIncentive({ ...entry, cashAdvanceDeduction }, Number(entry.incentivePay));
    await tx.update(payrollEntriesTable).set({
      cashAdvanceDeduction, ...totals, computedAt: new Date(),
    }).where(eq(payrollEntriesTable.id, entry.id));
    await tx.update(payrollPeriodsTable).set({
      status: "draft", approvedAt: null, updatedAt: new Date(),
    }).where(eq(payrollPeriodsTable.id, periodId));
  });
}
