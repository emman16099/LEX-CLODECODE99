import { and, eq, ne } from "drizzle-orm";
import { db, payrollEntriesTable, payrollIncentivesTable, payrollPeriodsTable, payrollIncentiveChangesTable } from "@workspace/db";

export function incentiveTotal(weeklyAmount: string, weeks: number): number {
  const amount = Number(weeklyAmount);
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(weeklyAmount) || !Number.isInteger(weeks) || weeks < 1 || weeks > 53) {
    throw new Error("Enter a valid weekly amount and 1–53 whole weeks");
  }
  const cents = Math.round(amount * 100) * weeks;
  if (cents > 9999999999) throw new Error("Total incentive is too large");
  return cents / 100;
}

export function totalsWithIncentive(
  entry: { regularPay: string; overtimePay: string; lateDeductionTotal: string; undertimeDeductionTotal: string; cashAdvanceDeduction: string },
  incentive: number,
) {
  const grossPay = Number(entry.regularPay) + Number(entry.overtimePay) + incentive;
  const netPay = Math.max(0, grossPay - Number(entry.lateDeductionTotal) - Number(entry.undertimeDeductionTotal) - Number(entry.cashAdvanceDeduction));
  if (grossPay > 99999999.99) throw new Error("Total pay is too large");
  return { grossPay: grossPay.toFixed(2), netPay: netPay.toFixed(2) };
}

export async function savePayrollIncentive(
  periodId: string,
  employeeId: string,
  input: { weeklyAmount: string; weeks: number; note: string },
  editor: { id: string; name: string },
) {
  const incentivePay = incentiveTotal(input.weeklyAmount, input.weeks);
  await db.transaction(async (tx) => {
    // Generation, approval and paid transitions claim this same period row.
    const [period] = await tx.update(payrollPeriodsTable)
      .set({ updatedAt: new Date() })
      .where(and(eq(payrollPeriodsTable.id, periodId), ne(payrollPeriodsTable.status, "paid")))
      .returning();
    if (!period) throw new Error("Payroll period not found or already paid");
    const [entry] = await tx.select().from(payrollEntriesTable).where(and(
      eq(payrollEntriesTable.payrollPeriodId, periodId),
      eq(payrollEntriesTable.employeeId, employeeId),
    ));
    if (!entry) throw new Error("Recalculate payroll for this employee before adding an incentive");
    const totals = totalsWithIncentive(entry, incentivePay);
    const [previous] = await tx.select().from(payrollIncentivesTable).where(and(
      eq(payrollIncentivesTable.payrollPeriodId, periodId),
      eq(payrollIncentivesTable.employeeId, employeeId),
    ));
    await tx.insert(payrollIncentiveChangesTable).values({
      payrollPeriodId: periodId, employeeId,
      previousWeeklyAmount: previous?.weeklyAmount ?? null,
      previousWeeks: previous?.weeks ?? null,
      previousNote: previous?.note ?? null,
      newWeeklyAmount: Number(input.weeklyAmount).toFixed(2),
      newWeeks: input.weeks, newNote: input.note.trim(),
      editedBy: editor.id, editedByName: editor.name,
    });
    await tx.insert(payrollIncentivesTable).values({
      payrollPeriodId: periodId, employeeId,
      weeklyAmount: Number(input.weeklyAmount).toFixed(2), weeks: input.weeks, note: input.note.trim(),
    }).onConflictDoUpdate({
      target: [payrollIncentivesTable.payrollPeriodId, payrollIncentivesTable.employeeId],
      set: { weeklyAmount: Number(input.weeklyAmount).toFixed(2), weeks: input.weeks, note: input.note.trim(), updatedAt: new Date() },
    });
    await tx.update(payrollEntriesTable).set({
      incentivePay: incentivePay.toFixed(2), ...totals, computedAt: new Date(),
    }).where(eq(payrollEntriesTable.id, entry.id));
    await tx.update(payrollPeriodsTable).set({
      status: "draft", approvedAt: null, updatedAt: new Date(),
    }).where(eq(payrollPeriodsTable.id, periodId));
  });
}
