import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  payrollPeriodsTable,
  payrollEntriesTable,
  payrollIncentivesTable,
  payrollIncentiveChangesTable,
  employeesTable,
  attendanceSummariesTable,
  appUsersTable,
  specialWorkingDaysTable,
  overtimeLogsTable,
  cashAdvancesTable,
} from "@workspace/db";
import { eq, and, gte, lte, inArray, isNotNull, isNull, ne, or, desc } from "drizzle-orm";
import {
  CreatePayrollPeriodBody,
  CreateSpecialWorkingDayBody,
  GeneratePayrollEntriesBody,
  UpdatePayrollIncentiveBody,
  ListPayrollIncentiveChangesParams,
  ListPayrollIncentiveChangesResponse,
} from "@workspace/api-zod";
import { getEmployeeRateForDate } from "../lib/employee-rates";
import { incentiveTotal, savePayrollIncentive, totalsWithIncentive } from "../lib/payroll-incentives";
import { includePayrollAdvance, PayrollAdvanceError } from "../lib/include-payroll-advance";

const router: IRouter = Router();
type PayrollDatabase = Pick<
  typeof db,
  "select" | "delete" | "insert" | "update" | "transaction"
>;

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

async function getAppUser(replitId: string) {
  const [u] = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.replitId, replitId));
  return u ?? null;
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + "T00:00:00Z").getUTCDay();
  return day === 0 || day === 6;
}

export function canDeletePayrollPeriod(status: string): boolean {
  return status === "draft" || status === "approved";
}

export function isCashAdvanceEligible(
  advance: { advanceDate: string; deductionDate?: string | null; deductedPayrollPeriodId?: string | null },
  periodId: string,
  periodEndDate: string,
): boolean {
  if (advance.deductedPayrollPeriodId === periodId) return true;
  if (advance.deductedPayrollPeriodId) return false;
  return (advance.deductionDate ?? advance.advanceDate) <= periodEndDate;
}

function countWorkingDays(startStr: string, endStr: string): number {
  return countEffectiveWorkingDays(startStr, endStr, new Set());
}

function countEffectiveWorkingDays(
  startStr: string,
  endStr: string,
  specialDates: Set<string>,
): number {
  const start = new Date(startStr + "T00:00:00Z");
  const end = new Date(endStr + "T00:00:00Z");
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getUTCDay();
    const dateStr = d.toISOString().split("T")[0];
    if (day !== 0 && day !== 6) count++;          // Mon–Fri
    else if (specialDates.has(dateStr)) count++;   // declared special working day
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

function serializePeriod(p: typeof payrollPeriodsTable.$inferSelect) {
  return {
    id: p.id,
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
    generatedAt: p.generatedAt ? p.generatedAt.toISOString() : null,
    approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function serializeEntry(e: typeof payrollEntriesTable.$inferSelect) {
  return {
    id: e.id,
    payrollPeriodId: e.payrollPeriodId,
    employeeId: e.employeeId,
    dailyRateSnapshot: e.dailyRateSnapshot,
    daysPresent: e.daysPresent,
    daysAbsent: e.daysAbsent,
    lateCount: e.lateCount,
    totalLateMinutes: e.totalLateMinutes,
    undertimeCount: e.undertimeCount,
    totalUndertimeMinutes: e.totalUndertimeMinutes,
    regularPay: e.regularPay,
    lateDeductionTotal: e.lateDeductionTotal,
    undertimeDeductionTotal: e.undertimeDeductionTotal,
    cashAdvanceDeduction: e.cashAdvanceDeduction,
    overtimePay: e.overtimePay,
    incentivePay: e.incentivePay,
    grossPay: e.grossPay,
    netPay: e.netPay,
    computedAt: e.computedAt.toISOString(),
  };
}

function serializeEmployee(e: typeof employeesTable.$inferSelect) {
  return {
    id: e.id,
    employeeCode: e.employeeCode,
    firstName: e.firstName,
    lastName: e.lastName,
    mobileNumber: e.mobileNumber,
    address: e.address,
    hireDate: e.hireDate,
    employmentStatus: e.employmentStatus,
    dailyRate: e.dailyRate,
    mondayRate: e.mondayRate ?? null,
    tuesdayRate: e.tuesdayRate ?? null,
    wednesdayRate: e.wednesdayRate ?? null,
    thursdayRate: e.thursdayRate ?? null,
    fridayRate: e.fridayRate ?? null,
    saturdayRate: e.saturdayRate ?? null,
    sundayRate: e.sundayRate ?? null,
    overtimeRate: e.overtimeRate ?? null,
    sssNumber: e.sssNumber,
    philhealthNumber: e.philhealthNumber,
    pagibigNumber: e.pagibigNumber,
    portalUsername: e.portalUsername ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export async function generatePayrollEntries(
  periodId: string,
  startDate: string,
  endDate: string,
  employeeIds: string[],
  database: PayrollDatabase = db,
  cashAdvanceIds: string[] = [],
) {
  if (employeeIds.length === 0) {
    throw new Error("Select at least one active employee");
  }

  return database.transaction(async (tx) => {
  const claimedPeriods = await tx
    .update(payrollPeriodsTable)
    .set({ updatedAt: new Date() })
    .where(and(
      eq(payrollPeriodsTable.id, periodId),
      ne(payrollPeriodsTable.status, "paid"),
    ))
    .returning();
  if (claimedPeriods.length !== 1) {
    throw new Error("Cannot recalculate a payroll period that was changed or marked paid");
  }

  // Load special working days within the period (e.g. declared Sat/Sun workdays)
  const specialRows = await tx
    .select()
    .from(specialWorkingDaysTable)
    .where(
      and(
        gte(specialWorkingDaysTable.date, startDate),
        lte(specialWorkingDaysTable.date, endDate),
      ),
    );
  const specialDates = new Set(specialRows.map((r) => r.date));

  const employees = await tx
    .select()
    .from(employeesTable)
    .where(
      and(
        eq(employeesTable.employmentStatus, "active"),
        inArray(employeesTable.id, employeeIds),
      ),
    );

  if (employees.length !== employeeIds.length) {
    throw new Error("Selection contains an unknown or inactive employee");
  }

  const workingDays = countEffectiveWorkingDays(startDate, endDate, specialDates);
  const cashAdvances = await tx
    .select()
    .from(cashAdvancesTable)
    .where(
      and(
        inArray(cashAdvancesTable.employeeId, employeeIds),
        or(
          isNull(cashAdvancesTable.deductedPayrollPeriodId),
          eq(cashAdvancesTable.deductedPayrollPeriodId, periodId),
        ),
      ),
    );
  const selectedCashAdvanceIds = new Set(cashAdvanceIds);
  const eligibleCashAdvances = cashAdvances.filter(
    (advance) =>
      selectedCashAdvanceIds.has(advance.id) &&
      isCashAdvanceEligible(advance, periodId, endDate),
  );
  if (eligibleCashAdvances.length !== selectedCashAdvanceIds.size) {
    throw new Error("Cash advance selection contains an unavailable or future deduction");
  }
  const cashAdvanceTotals = new Map<string, number>();
  for (const advance of eligibleCashAdvances) {
    cashAdvanceTotals.set(
      advance.employeeId,
      (cashAdvanceTotals.get(advance.employeeId) ?? 0) + parseFloat(advance.amount),
    );
  }

  const inserts: (typeof payrollEntriesTable.$inferInsert)[] = [];
  const incentives = await tx.select().from(payrollIncentivesTable)
    .where(eq(payrollIncentivesTable.payrollPeriodId, periodId));
  const incentiveMap = new Map(incentives.map((incentive) => [incentive.employeeId, incentive]));

  for (const emp of employees) {
    const summaries = await tx
      .select()
      .from(attendanceSummariesTable)
      .where(
        and(
          eq(attendanceSummariesTable.employeeId, emp.id),
          gte(attendanceSummariesTable.date, startDate),
          lte(attendanceSummariesTable.date, endDate),
        ),
      );

    // Recorded attendance is always payable, including undeclared weekends.
    // Declared special working days remain part of the expected schedule so a
    // missing record on one of those dates still counts as an absence.
    const attendedSummaries = summaries.filter((s) =>
      ["present", "late"].includes(s.status),
    );
    const expectedAttendedSummaries = attendedSummaries.filter(
      (s) => !isWeekend(s.date) || specialDates.has(s.date),
    );

    const daysPresent = attendedSummaries.length;
    const daysAbsent = Math.max(0, workingDays - expectedAttendedSummaries.length);
    const lateCount = attendedSummaries.filter((s) => s.isLate).length;
    const totalLateMinutes = attendedSummaries.reduce(
      (sum, s) => sum + (s.lateMinutes ?? 0),
      0,
    );
    const lateDeductionTotal = attendedSummaries.reduce(
      (sum, s) => sum + parseFloat(s.lateDeductionAmount ?? "0"),
      0,
    );
    const dailyRate = parseFloat(emp.dailyRate ?? "0");
    const regularPay = attendedSummaries.reduce(
      (sum, summary) =>
        sum + parseFloat(summary.dailyRateOverride ?? getEmployeeRateForDate(emp, summary.date)),
      0,
    );

    // Approved overtime: sum hours from finalized OT logs in the period
    const otLogs = await tx
      .select()
      .from(overtimeLogsTable)
      .where(
        and(
          eq(overtimeLogsTable.employeeId, emp.id),
          eq(overtimeLogsTable.status, "ot_completed"),
          gte(overtimeLogsTable.periodDate, startDate),
          lte(overtimeLogsTable.periodDate, endDate),
        ),
      );
    const overtimePay = otLogs.reduce((sum, ot) => {
      const hours = parseFloat(String(ot.approvedOvertimeHours ?? "0"));
      const applicableDailyRate = parseFloat(
        attendedSummaries.find((summary) => summary.date === ot.periodDate)?.dailyRateOverride
          ?? getEmployeeRateForDate(emp, ot.periodDate),
      );
      const hourlyRate = parseFloat(
        emp.overtimeRate ?? String((applicableDailyRate / 8) * 1.25),
      );
      return sum + hours * hourlyRate;
    }, 0);

    // Undertime deductions: deduct for ALL undertime except where admin approved the excuse (status = 'approved' means excuse accepted, deduction waived)
    const undertimeDeductionTotal = attendedSummaries.reduce((sum, s) => {
      if (s.undertimeStatus !== "approved") {
        return sum + parseFloat(String(s.undertimeDeductionAmount ?? "0"));
      }
      return sum;
    }, 0);
    const undertimeCount = attendedSummaries.filter(
      (s) => (s.undertimeMinutes ?? 0) > 0 && s.undertimeStatus !== "approved",
    ).length;
    const totalUndertimeMinutes = attendedSummaries.reduce(
      (sum, s) => sum + (s.undertimeStatus !== "approved" ? (s.undertimeMinutes ?? 0) : 0),
      0,
    );

    const cashAdvanceDeduction = cashAdvanceTotals.get(emp.id) ?? 0;
    const incentive = incentiveMap.get(emp.id);
    const incentivePay = incentive ? incentiveTotal(incentive.weeklyAmount, incentive.weeks) : 0;
    const { grossPay, netPay } = totalsWithIncentive({
      regularPay: regularPay.toFixed(2), overtimePay: overtimePay.toFixed(2),
      lateDeductionTotal: lateDeductionTotal.toFixed(2),
      undertimeDeductionTotal: undertimeDeductionTotal.toFixed(2),
      cashAdvanceDeduction: cashAdvanceDeduction.toFixed(2),
    }, incentivePay);

    inserts.push({
      payrollPeriodId: periodId,
      employeeId: emp.id,
      dailyRateSnapshot: emp.dailyRate,
      daysPresent,
      daysAbsent,
      lateCount,
      totalLateMinutes,
      undertimeCount,
      totalUndertimeMinutes,
      regularPay: regularPay.toFixed(2),
      lateDeductionTotal: lateDeductionTotal.toFixed(2),
      undertimeDeductionTotal: undertimeDeductionTotal.toFixed(2),
      cashAdvanceDeduction: cashAdvanceDeduction.toFixed(2),
      overtimePay: overtimePay.toFixed(2),
      incentivePay: incentivePay.toFixed(2),
      grossPay,
      netPay,
    });
  }

  await tx
    .update(cashAdvancesTable)
    .set({ deductedPayrollPeriodId: null })
    .where(eq(cashAdvancesTable.deductedPayrollPeriodId, periodId));

  await tx
    .delete(payrollEntriesTable)
    .where(eq(payrollEntriesTable.payrollPeriodId, periodId));

  await tx.insert(payrollEntriesTable).values(inserts);
  if (eligibleCashAdvances.length > 0) {
    const assigned = await tx
      .update(cashAdvancesTable)
      .set({ deductedPayrollPeriodId: periodId })
      .where(and(
        inArray(cashAdvancesTable.id, eligibleCashAdvances.map((advance) => advance.id)),
        or(isNull(cashAdvancesTable.deductedPayrollPeriodId), eq(cashAdvancesTable.deductedPayrollPeriodId, periodId)),
      )).returning();
    if (assigned.length !== eligibleCashAdvances.length) {
      throw new Error("A cash advance was included in another payroll; refresh and try again");
    }
  }

  await tx
    .update(payrollPeriodsTable)
    .set({
      status: "draft",
      generatedAt: new Date(),
      approvedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(payrollPeriodsTable.id, periodId));
  });
}

async function fetchPeriodWithEntries(periodId: string) {
  const [period] = await db
    .select()
    .from(payrollPeriodsTable)
    .where(eq(payrollPeriodsTable.id, periodId));
  if (!period) return null;

  const entries = await db
    .select()
    .from(payrollEntriesTable)
    .where(eq(payrollEntriesTable.payrollPeriodId, periodId));

  const employeeIds = [...new Set(entries.map((e) => e.employeeId))];
  const employees =
    employeeIds.length > 0
      ? await db
          .select()
          .from(employeesTable)
          .where(inArray(employeesTable.id, employeeIds))
      : [];

  const empMap = new Map(employees.map((e) => [e.id, e]));
  const incentives = await db.select().from(payrollIncentivesTable)
    .where(eq(payrollIncentivesTable.payrollPeriodId, periodId));

  return {
    period: serializePeriod(period),
    incentives: incentives.map(({ employeeId, weeklyAmount, weeks, note }) => ({ employeeId, weeklyAmount, weeks, note })),
    entries: entries.map((e) => ({
      entry: serializeEntry(e),
      employee: empMap.has(e.employeeId)
        ? serializeEmployee(empMap.get(e.employeeId)!)
        : null,
    })),
  };
}

// ── GET /payroll/periods ─────────────────────────────────────────────────────
router.get("/payroll/periods", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const periods = await db
    .select()
    .from(payrollPeriodsTable)
    .orderBy(payrollPeriodsTable.startDate);

  res.json(periods.map(serializePeriod));
});

// ── POST /payroll/periods ────────────────────────────────────────────────────
router.post("/payroll/periods", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const parsed = CreatePayrollPeriodBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const startDateStr =
    parsed.data.startDate instanceof Date
      ? parsed.data.startDate.toISOString().split("T")[0]
      : String(parsed.data.startDate);
  const endDateStr =
    parsed.data.endDate instanceof Date
      ? parsed.data.endDate.toISOString().split("T")[0]
      : String(parsed.data.endDate);

  if (startDateStr > endDateStr) {
    res.status(400).json({ error: "startDate must be before or equal to endDate" });
    return;
  }

  const [period] = await db
    .insert(payrollPeriodsTable)
    .values({ startDate: startDateStr, endDate: endDateStr })
    .returning();

  res.status(201).json(serializePeriod(period));
});

// ── GET /payroll/periods/:id ─────────────────────────────────────────────────
router.get("/payroll/periods/:id", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const data = await fetchPeriodWithEntries(String(req.params.id));
  if (!data) {
    res.status(404).json({ error: "Payroll period not found" });
    return;
  }
  res.json(data);
});

router.delete("/payroll/periods/:id", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const id = String(req.params.id);
  const [period] = await db
    .select()
    .from(payrollPeriodsTable)
    .where(eq(payrollPeriodsTable.id, id));
  if (!period) {
    res.status(404).json({ error: "Payroll period not found" });
    return;
  }
  if (!canDeletePayrollPeriod(period.status)) {
    res.status(400).json({ error: "Paid payroll periods cannot be deleted" });
    return;
  }

  await db.delete(payrollPeriodsTable).where(eq(payrollPeriodsTable.id, id));
  res.status(204).send();
});

router.get("/payroll/periods/:id/incentives/:employeeId/history", async (req: Request, res: Response): Promise<void> => {
  if (!(await assertAdmin(req, res))) return;
  const params = ListPayrollIncentiveChangesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const changes = await db.select().from(payrollIncentiveChangesTable).where(and(
    eq(payrollIncentiveChangesTable.payrollPeriodId, params.data.id),
    eq(payrollIncentiveChangesTable.employeeId, params.data.employeeId),
  )).orderBy(desc(payrollIncentiveChangesTable.id));
  res.json(ListPayrollIncentiveChangesResponse.parse(changes));
});

router.patch("/payroll/periods/:id/incentives/:employeeId", async (req: Request, res: Response): Promise<void> => {
  if (!(await assertAdmin(req, res))) return;
  const parsed = UpdatePayrollIncentiveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const periodId = String(req.params.id);
  try {
    const editor = await getAppUser(req.user!.id);
    await savePayrollIncentive(periodId, String(req.params.employeeId), parsed.data, {
      id: editor!.id, name: editor!.replitUsername || editor!.replitId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if ([
      "Payroll period not found or already paid",
      "Recalculate payroll for this employee before adding an incentive",
      "Enter a valid weekly amount and 1–53 whole weeks",
      "Total incentive is too large", "Total pay is too large",
    ].includes(message)) {
      res.status(400).json({ error: message });
      return;
    }
    throw error;
  }
  res.json(await fetchPeriodWithEntries(periodId));
});

router.post("/payroll/periods/:id/cash-advances/:advanceId", async (req: Request, res: Response): Promise<void> => {
  if (!(await assertAdmin(req, res))) return;
  const periodId = String(req.params.id);
  try {
    await includePayrollAdvance(periodId, String(req.params.advanceId));
  } catch (error) {
    if (error instanceof PayrollAdvanceError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    throw error;
  }
  res.json(await fetchPeriodWithEntries(periodId));
});

// ── POST /payroll/periods/:id/generate ──────────────────────────────────────
router.post(
  "/payroll/periods/:id/generate",
  async (req: Request, res: Response) => {
    if (!(await assertAdmin(req, res))) return;

    const id = String(req.params.id);
    const [period] = await db
      .select()
      .from(payrollPeriodsTable)
      .where(eq(payrollPeriodsTable.id, id));

    if (!period) {
      res.status(404).json({ error: "Payroll period not found" });
      return;
    }
    if (period.status === "paid") {
      res
        .status(400)
        .json({ error: "Cannot recalculate a period that has been marked paid" });
      return;
    }

    const parsed = GeneratePayrollEntriesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const employeeIds = parsed.data.employeeIds.map(String);
    if (new Set(employeeIds).size !== employeeIds.length) {
      res.status(400).json({ error: "Employee selection contains duplicates" });
      return;
    }
    const cashAdvanceIds = parsed.data.cashAdvanceIds.map(String);
    if (new Set(cashAdvanceIds).size !== cashAdvanceIds.length) {
      res.status(400).json({ error: "Cash advance selection contains duplicates" });
      return;
    }

    try {
      await generatePayrollEntries(
        id,
        period.startDate,
        period.endDate,
        employeeIds,
        db,
        cashAdvanceIds,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        [
          "Select at least one active employee",
          "Selection contains an unknown or inactive employee",
          "Cash advance selection contains an unavailable or future deduction",
          "A cash advance was included in another payroll; refresh and try again",
        ].includes(error.message)
      ) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }

    const data = await fetchPeriodWithEntries(id);
    res.json(data);
  },
);

// ── PATCH /payroll/periods/:id/approve ──────────────────────────────────────
router.patch(
  "/payroll/periods/:id/approve",
  async (req: Request, res: Response) => {
    if (!(await assertAdmin(req, res))) return;

    const id = String(req.params.id);
    const [period] = await db
      .select()
      .from(payrollPeriodsTable)
      .where(eq(payrollPeriodsTable.id, id));

    if (!period) {
      res.status(404).json({ error: "Payroll period not found" });
      return;
    }
    if (period.status === "paid") {
      res.status(400).json({ error: "Period is already marked paid" });
      return;
    }
    if (period.status === "approved") {
      res.status(400).json({ error: "Period is already approved" });
      return;
    }
    if (!period.generatedAt) {
      res
        .status(400)
        .json({ error: "Generate payroll entries before approving" });
      return;
    }

    const [updated] = await db
      .update(payrollPeriodsTable)
      .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(payrollPeriodsTable.id, id),
        eq(payrollPeriodsTable.status, "draft"),
        isNotNull(payrollPeriodsTable.generatedAt),
      ))
      .returning();
    if (!updated) {
      res.status(409).json({ error: "Payroll changed before approval; refresh and generate it again if needed" });
      return;
    }

    res.json(serializePeriod(updated));
  },
);

// ── PATCH /payroll/periods/:id/mark-paid ────────────────────────────────────
router.patch(
  "/payroll/periods/:id/mark-paid",
  async (req: Request, res: Response) => {
    if (!(await assertAdmin(req, res))) return;

    const id = String(req.params.id);
    const [period] = await db
      .select()
      .from(payrollPeriodsTable)
      .where(eq(payrollPeriodsTable.id, id));

    if (!period) {
      res.status(404).json({ error: "Payroll period not found" });
      return;
    }
    if (period.status === "paid") {
      res.status(400).json({ error: "Period is already marked paid" });
      return;
    }
    if (period.status !== "approved") {
      res.status(400).json({ error: "Approve the payroll period before marking it paid" });
      return;
    }

    const [updated] = await db
      .update(payrollPeriodsTable)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(payrollPeriodsTable.id, id),
        eq(payrollPeriodsTable.status, "approved"),
      ))
      .returning();
    if (!updated) {
      res.status(409).json({ error: "Payroll changed before payment; refresh and try again" });
      return;
    }

    res.json(serializePeriod(updated));
  },
);

// ── GET /payroll/special-working-days ───────────────────────────────────────
router.get(
  "/payroll/special-working-days",
  async (req: Request, res: Response) => {
    if (!(await assertAdmin(req, res))) return;

    const rows = await db
      .select()
      .from(specialWorkingDaysTable)
      .orderBy(specialWorkingDaysTable.date);

    res.json(
      rows.map((r) => ({
        id: r.id,
        date: r.date,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  },
);

// ── POST /payroll/special-working-days ──────────────────────────────────────
router.post(
  "/payroll/special-working-days",
  async (req: Request, res: Response) => {
    if (!(await assertAdmin(req, res))) return;

    const parsed = CreateSpecialWorkingDayBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const dateStr =
      parsed.data.date instanceof Date
        ? parsed.data.date.toISOString().split("T")[0]
        : String(parsed.data.date);

    const existing = await db
      .select()
      .from(specialWorkingDaysTable)
      .where(eq(specialWorkingDaysTable.date, dateStr));

    if (existing.length > 0) {
      res.status(409).json({ error: `${dateStr} is already a special working day` });
      return;
    }

    const [row] = await db
      .insert(specialWorkingDaysTable)
      .values({ date: dateStr, reason: parsed.data.reason })
      .returning();

    res.status(201).json({
      id: row.id,
      date: row.date,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    });
  },
);

// ── DELETE /payroll/special-working-days/:id ─────────────────────────────────
router.delete(
  "/payroll/special-working-days/:id",
  async (req: Request, res: Response) => {
    if (!(await assertAdmin(req, res))) return;

    const id = String(req.params.id);
    const [row] = await db
      .select()
      .from(specialWorkingDaysTable)
      .where(eq(specialWorkingDaysTable.id, id));

    if (!row) {
      res.status(404).json({ error: "Special working day not found" });
      return;
    }

    await db
      .delete(specialWorkingDaysTable)
      .where(eq(specialWorkingDaysTable.id, id));

    res.status(204).send();
  },
);

// ── GET /payroll/my-history ──────────────────────────────────────────────────
router.get("/payroll/my-history", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const appUser = await getAppUser(req.user!.id);
  if (!appUser || !appUser.employeeId) {
    res.status(403).json({ error: "No employee record linked to this account" });
    return;
  }

  const entries = await db
    .select()
    .from(payrollEntriesTable)
    .where(eq(payrollEntriesTable.employeeId, appUser.employeeId))
    .orderBy(payrollEntriesTable.createdAt);

  const periodIds = [...new Set(entries.map((e) => e.payrollPeriodId))];
  const periods =
    periodIds.length > 0
      ? await db
          .select()
          .from(payrollPeriodsTable)
          .where(inArray(payrollPeriodsTable.id, periodIds))
      : [];

  const periodMap = new Map(periods.map((p) => [p.id, p]));

  res.json(
    entries.map((e) => ({
      entry: serializeEntry(e),
      period: periodMap.has(e.payrollPeriodId)
        ? serializePeriod(periodMap.get(e.payrollPeriodId)!)
        : null,
    })),
  );
});

export default router;
