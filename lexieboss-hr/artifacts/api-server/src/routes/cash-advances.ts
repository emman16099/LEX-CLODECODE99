import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, appUsersTable, cashAdvancesTable, employeesTable, payrollPeriodsTable } from "@workspace/db";
import { CreateCashAdvanceBody, UpdateCashAdvanceBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function assertAdmin(req: Request, res: Response): Promise<boolean> {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  const [appUser] = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.replitId, req.user!.id));
  if (!appUser || appUser.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

function serializeCashAdvance(advance: typeof cashAdvancesTable.$inferSelect, payrollStatus: "draft" | "approved" | "paid" | null = null) {
  return {
    payrollStatus,
    id: advance.id,
    employeeId: advance.employeeId,
    amount: advance.amount,
    advanceDate: advance.advanceDate,
    deductionDate: advance.deductionDate ?? null,
    note: advance.note ?? null,
    deductedPayrollPeriodId: advance.deductedPayrollPeriodId ?? null,
    createdAt: advance.createdAt.toISOString(),
  };
}

router.get("/cash-advances", async (req: Request, res: Response): Promise<void> => {
  if (!(await assertAdmin(req, res))) return;

  const advances = await db.select({ advance: cashAdvancesTable, payrollStatus: payrollPeriodsTable.status })
    .from(cashAdvancesTable)
    .leftJoin(payrollPeriodsTable, eq(payrollPeriodsTable.id, cashAdvancesTable.deductedPayrollPeriodId));
  res.json(advances.map(({ advance, payrollStatus }) => serializeCashAdvance(advance, payrollStatus)));
});

router.post("/cash-advances", async (req: Request, res: Response): Promise<void> => {
  if (!(await assertAdmin(req, res))) return;

  const parsed = CreateCashAdvanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const amount = Number(parsed.data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "Amount must be greater than zero" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, parsed.data.employeeId));
  if (!employee) {
    res.status(400).json({ error: "Employee not found" });
    return;
  }

  const advanceDate =
    parsed.data.advanceDate instanceof Date
      ? parsed.data.advanceDate.toISOString().split("T")[0]
      : String(parsed.data.advanceDate);
  const deductionDate =
    parsed.data.deductionDate instanceof Date
      ? parsed.data.deductionDate.toISOString().split("T")[0]
      : String(parsed.data.deductionDate);
  const [advance] = await db
    .insert(cashAdvancesTable)
    .values({
      employeeId: employee.id,
      amount: amount.toFixed(2),
      advanceDate,
      deductionDate,
      note: parsed.data.note?.trim() || null,
    })
    .returning();

  res.status(201).json(serializeCashAdvance(advance));
});

router.patch("/cash-advances/:id", async (req: Request, res: Response): Promise<void> => {
  if (!(await assertAdmin(req, res))) return;

  const parsed = UpdateCashAdvanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const amount = Number(parsed.data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "Amount must be greater than zero" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, parsed.data.employeeId));
  if (!employee) {
    res.status(400).json({ error: "Employee not found" });
    return;
  }

  const id = String(req.params.id);
  const advanceDate =
    parsed.data.advanceDate instanceof Date
      ? parsed.data.advanceDate.toISOString().split("T")[0]
      : String(parsed.data.advanceDate);
  const deductionDate =
    parsed.data.deductionDate instanceof Date
      ? parsed.data.deductionDate.toISOString().split("T")[0]
      : String(parsed.data.deductionDate);
  const [advance] = await db
    .update(cashAdvancesTable)
    .set({
      employeeId: employee.id,
      amount: amount.toFixed(2),
      advanceDate,
      deductionDate,
      note: parsed.data.note?.trim() || null,
    })
    .where(eq(cashAdvancesTable.id, id))
    .returning();

  if (!advance) {
    res.status(404).json({ error: "Cash advance not found" });
    return;
  }

  res.json(serializeCashAdvance(advance));
});

router.delete("/cash-advances/:id", async (req: Request, res: Response): Promise<void> => {
  if (!(await assertAdmin(req, res))) return;

  const id = String(req.params.id);
  const [advance] = await db
    .select()
    .from(cashAdvancesTable)
    .where(eq(cashAdvancesTable.id, id));
  if (!advance) {
    res.status(404).json({ error: "Cash advance not found" });
    return;
  }
  await db.delete(cashAdvancesTable).where(and(
    eq(cashAdvancesTable.id, id),
    inArray(cashAdvancesTable.employeeId, [advance.employeeId]),
  ));
  res.status(204).send();
});

export default router;