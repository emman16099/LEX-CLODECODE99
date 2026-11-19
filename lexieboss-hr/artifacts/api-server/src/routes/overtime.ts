import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  overtimeLogsTable,
  attendanceLogsTable,
  attendanceRulesTable,
  employeesTable,
  appUsersTable,
  overtimeCorrectionsTable,
} from "@workspace/db";
import { eq, and, gte, lte, isNull, inArray } from "drizzle-orm";
import {
  RequestOvertimeBody,
  AssignOvertimeBody,
  ManuallyRecordOvertimeBody,
  RejectOvertimeBody,
  ReviewOvertimeBody,
  VoidOvertimeBody,
  CorrectOvertimeTimeOutBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getAppUser(replitId: string) {
  const [u] = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.replitId, replitId));
  return u ?? null;
}

async function assertAdmin(req: Request, res: Response): Promise<boolean> {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  const appUser = await getAppUser(req.user!.id);
  if (!appUser || appUser.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

async function assertEmployeeUser(
  req: Request,
  res: Response,
): Promise<{ employeeId: string; adminName: string } | null> {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const appUser = await getAppUser(req.user!.id);
  if (!appUser?.employeeId) {
    res.status(403).json({ error: "No employee profile linked" });
    return null;
  }
  const fullName =
    `${req.user?.firstName ?? ""} ${req.user?.lastName ?? ""}`.trim() ||
    req.user?.id ||
    "Unknown";
  return { employeeId: appUser.employeeId, adminName: fullName };
}

function toISODate(d: Date | string): string {
  return d instanceof Date ? d.toISOString().split("T")[0] : String(d);
}

function getPHTHour(utcDate: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: "Asia/Manila",
  });
  return parseInt(fmt.format(utcDate), 10);
}

function getPHTDateAndMinutes(now: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours! * 60 + minutes!;
}

export function isMatchedEarlyOvertime(
  plannedStartTime: string | null | undefined,
  plannedEndTime: string | null | undefined,
  shiftStart: string | null | undefined,
): boolean {
  return Boolean(
    plannedStartTime &&
    plannedEndTime &&
    shiftStart &&
    timeToMinutes(plannedStartTime) < timeToMinutes(plannedEndTime) &&
    timeToMinutes(plannedEndTime) === timeToMinutes(shiftStart),
  );
}

export function getManualOvertimeControlError(
  row: {
    assignmentSource?: string | null;
    plannedStartTime?: string | null;
    plannedEndTime?: string | null;
  },
  activeShiftRules: Array<{ isActive?: boolean | null; shiftStart?: string | null }>,
  action: "clock_in" | "clock_out",
): string | null {
  const isEarlyAssignment =
    row.assignmentSource === "admin_assignment" &&
    isMatchedEarlyOvertime(
      row.plannedStartTime,
      row.plannedEndTime,
      activeShiftRules.find(
        (rule) => rule.isActive && rule.shiftStart === row.plannedEndTime,
      )?.shiftStart,
    );
  if (!isEarlyAssignment) return null;
  return action === "clock_in"
    ? "Early assigned overtime starts only through the gate QR clock-in"
    : "Early assigned overtime ends automatically at the regular shift start";
}

let unauthorizedScanInFlight: Promise<{ created: number }> | null = null;

function serializeOTLog(row: typeof overtimeLogsTable.$inferSelect) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    periodDate: row.periodDate,
    attendanceLogId: row.attendanceLogId ?? null,
    otReason: row.otReason ?? null,
    assignmentSource: row.assignmentSource ?? null,
    plannedStartTime: row.plannedStartTime ?? null,
    plannedEndTime: row.plannedEndTime ?? null,
    status: row.status,
    otInTime: row.otInTime ? row.otInTime.toISOString() : null,
    otOutTime: row.otOutTime ? row.otOutTime.toISOString() : null,
    approvedBy: row.approvedBy ?? null,
    approvedByName: row.approvedByName ?? null,
    approvalTimestamp: row.approvalTimestamp
      ? row.approvalTimestamp.toISOString()
      : null,
    approvedOvertimeHours: row.approvedOvertimeHours ?? null,
    adminNotes: row.adminNotes ?? null,
    voidedBy: row.voidedBy ?? null,
    voidedByName: row.voidedByName ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function reconcileCompletedEarlyOvertime(
  now = new Date(),
  database: Pick<typeof db, "select" | "update"> = db,
): Promise<void> {
  const pht = getPHTDateAndMinutes(now);
  const candidates = await database
    .select({
      id: overtimeLogsTable.id,
      periodDate: overtimeLogsTable.periodDate,
      plannedStartTime: overtimeLogsTable.plannedStartTime,
      plannedEndTime: overtimeLogsTable.plannedEndTime,
      shiftStart: attendanceRulesTable.shiftStart,
    })
    .from(overtimeLogsTable)
    .innerJoin(
      attendanceLogsTable,
      and(
        eq(attendanceLogsTable.employeeId, overtimeLogsTable.employeeId),
        eq(attendanceLogsTable.date, overtimeLogsTable.periodDate),
      ),
    )
    .innerJoin(
      attendanceRulesTable,
      eq(attendanceRulesTable.id, attendanceLogsTable.attendanceRuleId),
    )
    .where(
      and(
        eq(overtimeLogsTable.periodDate, pht.date),
        eq(overtimeLogsTable.status, "ot_in_progress"),
        eq(overtimeLogsTable.assignmentSource, "admin_assignment"),
      ),
    );

  await Promise.all(
    candidates
      .filter(
        (candidate) =>
          candidate.plannedEndTime &&
          isMatchedEarlyOvertime(
            candidate.plannedStartTime,
            candidate.plannedEndTime,
            candidate.shiftStart,
          ) &&
          pht.minutes >= timeToMinutes(candidate.plannedEndTime),
      )
      .map(async (candidate) => {
        const plannedEndTime = candidate.plannedEndTime!;
        await database
          .update(overtimeLogsTable)
          .set({
            status: "ot_completed_pending_review",
            otOutTime: new Date(
              `${candidate.periodDate}T${plannedEndTime}:00+08:00`,
            ),
            updatedAt: now,
          })
          .where(
            and(
              eq(overtimeLogsTable.id, candidate.id),
              eq(overtimeLogsTable.status, "ot_in_progress"),
            ),
          );
      }),
  );
}

const earlyOvertimeReconciler = setInterval(() => {
  void reconcileCompletedEarlyOvertime().catch((error) => {
    console.error("Failed to reconcile completed early overtime", error);
  });
}, 15_000);
earlyOvertimeReconciler.unref();

// ─── employee endpoints ────────────────────────────────────────────────────────

// POST /overtime/request
router.post("/overtime/request", async (req: Request, res: Response) => {
  const me = await assertEmployeeUser(req, res);
  if (!me) return;

  const parsed = RequestOvertimeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", details: parsed.error.flatten() });
    return;
  }

  const periodDate = toISODate(parsed.data.periodDate);
  const { otReason } = parsed.data;

  // Prevent duplicate requests for the same date
  const [existing] = await db
    .select()
    .from(overtimeLogsTable)
    .where(
      and(
        eq(overtimeLogsTable.employeeId, me.employeeId),
        eq(overtimeLogsTable.periodDate, periodDate),
      ),
    );

  if (existing) {
    res.status(400).json({ error: "An overtime log already exists for this date" });
    return;
  }

  const [inserted] = await db
    .insert(overtimeLogsTable)
    .values({
      employeeId: me.employeeId,
      periodDate,
      otReason,
      status: "ot_requested",
    })
    .returning();

  res.status(201).json(serializeOTLog(inserted!));
});

// GET /overtime/my-requests
router.get("/overtime/my-requests", async (req: Request, res: Response) => {
  const me = await assertEmployeeUser(req, res);
  if (!me) return;

  await reconcileCompletedEarlyOvertime();
  const rows = await db
    .select()
    .from(overtimeLogsTable)
    .where(eq(overtimeLogsTable.employeeId, me.employeeId))
    .orderBy(overtimeLogsTable.periodDate);

  res.json(rows.map(serializeOTLog));
});

router.post("/overtime/auto-start-assigned", async (req: Request, res: Response) => {
  const me = await assertEmployeeUser(req, res);
  if (!me) return;

  const now = new Date();
  const pht = getPHTDateAndMinutes(now);
  const rows = await db
    .select()
    .from(overtimeLogsTable)
    .where(
      and(
        eq(overtimeLogsTable.employeeId, me.employeeId),
        eq(overtimeLogsTable.periodDate, pht.date),
        inArray(overtimeLogsTable.status, ["ot_approved", "ot_in_progress"]),
        eq(overtimeLogsTable.assignmentSource, "admin_assignment"),
      ),
    );

  const [attendanceLog] = await db
    .select()
    .from(attendanceLogsTable)
    .where(
      and(
        eq(attendanceLogsTable.employeeId, me.employeeId),
        eq(attendanceLogsTable.date, pht.date),
      ),
    );
  const [attendanceRule] = attendanceLog?.attendanceRuleId
    ? await db
        .select()
        .from(attendanceRulesTable)
        .where(eq(attendanceRulesTable.id, attendanceLog.attendanceRuleId))
    : [];

  // Close a scheduled early-OT window at its planned end. The employee's
  // regular attendance remains separate and can continue until shift end.
  const earlyInProgress = rows.find(
    (row) =>
      row.status === "ot_in_progress" &&
      row.plannedStartTime &&
      row.plannedEndTime &&
      attendanceRule &&
      isMatchedEarlyOvertime(
        row.plannedStartTime,
        row.plannedEndTime,
        attendanceRule.shiftStart,
      ) &&
      pht.minutes >= timeToMinutes(row.plannedEndTime),
  );
  if (earlyInProgress?.plannedEndTime) {
    const scheduledEnd = new Date(
      `${pht.date}T${earlyInProgress.plannedEndTime}:00+08:00`,
    );
    const [updated] = await db
      .update(overtimeLogsTable)
      .set({
        status: "ot_completed_pending_review",
        otOutTime: scheduledEnd,
        updatedAt: now,
      })
      .where(
        and(
          eq(overtimeLogsTable.id, earlyInProgress.id),
          eq(overtimeLogsTable.status, "ot_in_progress"),
        ),
      )
      .returning();

    res.json({
      started: false,
      overtimeLog: updated ? serializeOTLog(updated) : null,
    });
    return;
  }

  const eligible = rows.find(
    (row) =>
      attendanceLog?.clockInAt &&
      row.status === "ot_approved" &&
      row.plannedStartTime &&
      row.plannedEndTime &&
      pht.minutes >= timeToMinutes(row.plannedStartTime) &&
      pht.minutes < timeToMinutes(row.plannedEndTime),
  );

  if (!eligible) {
    res.json({ started: false, overtimeLog: null });
    return;
  }

  const [updated] = await db
    .update(overtimeLogsTable)
    .set({ status: "ot_in_progress", otInTime: now, updatedAt: now })
    .where(
      and(
        eq(overtimeLogsTable.id, eligible.id),
        eq(overtimeLogsTable.status, "ot_approved"),
      ),
    )
    .returning();

  res.json({
    started: Boolean(updated),
    overtimeLog: updated ? serializeOTLog(updated) : null,
  });
});

// POST /overtime/:id/clock-in
router.post("/overtime/:id/clock-in", async (req: Request, res: Response) => {
  const me = await assertEmployeeUser(req, res);
  if (!me) return;

  const id = String(req.params["id"]);
  const [row] = await db
    .select()
    .from(overtimeLogsTable)
    .where(
      and(
        eq(overtimeLogsTable.id, id),
        eq(overtimeLogsTable.employeeId, me.employeeId),
      ),
    );

  if (!row) {
    res.status(404).json({ error: "OT log not found" });
    return;
  }
  if (row.assignmentSource === "admin_assignment" && row.plannedStartTime && row.plannedEndTime) {
    const matchingShiftRules = await db
      .select()
      .from(attendanceRulesTable)
      .where(
        and(
          eq(attendanceRulesTable.isActive, true),
          eq(attendanceRulesTable.shiftStart, row.plannedEndTime),
        ),
      );
    if (getManualOvertimeControlError(row, matchingShiftRules, "clock_in")) {
      res.status(400).json({
        error: "Early assigned overtime starts only through the gate QR clock-in",
      });
      return;
    }
  }
  if (row.status !== "ot_approved") {
    res.status(400).json({ error: `Cannot clock in — status is "${row.status}"` });
    return;
  }

  const [updated] = await db
    .update(overtimeLogsTable)
    .set({ status: "ot_in_progress", otInTime: new Date(), updatedAt: new Date() })
    .where(eq(overtimeLogsTable.id, id))
    .returning();

  res.json(serializeOTLog(updated!));
});

// POST /overtime/:id/clock-out
router.post("/overtime/:id/clock-out", async (req: Request, res: Response) => {
  const me = await assertEmployeeUser(req, res);
  if (!me) return;

  const id = String(req.params["id"]);
  const [row] = await db
    .select()
    .from(overtimeLogsTable)
    .where(
      and(
        eq(overtimeLogsTable.id, id),
        eq(overtimeLogsTable.employeeId, me.employeeId),
      ),
    );

  if (!row) {
    res.status(404).json({ error: "OT log not found" });
    return;
  }
  if (row.assignmentSource === "admin_assignment" && row.plannedStartTime && row.plannedEndTime) {
    const matchingShiftRules = await db
      .select()
      .from(attendanceRulesTable)
      .where(
        and(
          eq(attendanceRulesTable.isActive, true),
          eq(attendanceRulesTable.shiftStart, row.plannedEndTime),
        ),
      );
    if (getManualOvertimeControlError(row, matchingShiftRules, "clock_out")) {
      res.status(400).json({
        error: "Early assigned overtime ends automatically at the regular shift start",
      });
      return;
    }
  }
  if (row.status !== "ot_in_progress") {
    res.status(400).json({ error: `Cannot clock out — status is "${row.status}"` });
    return;
  }

  const [updated] = await db
    .update(overtimeLogsTable)
    .set({
      status: "ot_completed_pending_review",
      otOutTime: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(overtimeLogsTable.id, id))
    .returning();

  res.json(serializeOTLog(updated!));
});

// ─── admin endpoints ───────────────────────────────────────────────────────────

// GET /admin/overtime
router.get("/admin/overtime", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  await reconcileCompletedEarlyOvertime();
  const { status, date } = req.query as { status?: string; date?: string };

  const conditions = [];
  if (status && status !== "ot_completed_pending_review") {
    conditions.push(eq(overtimeLogsTable.status, status));
  }
  if (date) conditions.push(eq(overtimeLogsTable.periodDate, date));

  const rows = await db
    .select()
    .from(overtimeLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(overtimeLogsTable.periodDate);

  const manilaToday = getPHTDateAndMinutes(new Date()).date;
  const visibleRows = status === "ot_completed_pending_review"
    ? rows.filter((row) =>
        row.status === "ot_completed_pending_review" ||
        (row.status === "ot_in_progress" && row.periodDate < manilaToday && !row.otOutTime),
      )
    : rows;
  const results = await Promise.all(
    visibleRows.map(async (otLog) => {
      const [employee] = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.id, otLog.employeeId));
      return {
        overtimeLog: serializeOTLog(otLog),
        employee: employee
          ? {
              id: employee.id,
              employeeCode: employee.employeeCode,
              firstName: employee.firstName,
              lastName: employee.lastName,
              mobileNumber: employee.mobileNumber,
              address: employee.address,
              hireDate: employee.hireDate,
              employmentStatus: employee.employmentStatus,
              dailyRate: employee.dailyRate,
              sssNumber: employee.sssNumber,
              philhealthNumber: employee.philhealthNumber,
              pagibigNumber: employee.pagibigNumber,
              portalUsername: employee.portalUsername ?? null,
              createdAt: employee.createdAt.toISOString(),
              updatedAt: employee.updatedAt.toISOString(),
            }
          : null,
      };
    }),
  );

  res.json(results);
});

// POST /admin/overtime/assign
// Must be before parameterized /admin/overtime/:id routes.
router.post("/admin/overtime/assign", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const parsed = AssignOvertimeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", details: parsed.error.flatten() });
    return;
  }
  const periodDate = toISODate(parsed.data.periodDate);
  const { employeeId, plannedStartTime, plannedEndTime, otReason } = parsed.data;
  if (timeToMinutes(plannedEndTime) <= timeToMinutes(plannedStartTime)) {
    res.status(400).json({ error: "End time must be later than start time" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId));
  if (!employee || employee.employmentStatus !== "active") {
    res.status(404).json({ error: "Active employee not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(overtimeLogsTable)
    .where(
      and(
        eq(overtimeLogsTable.employeeId, employeeId),
        eq(overtimeLogsTable.periodDate, periodDate),
      ),
    );
  if (existing) {
    res.status(409).json({ error: "This employee already has an overtime record for that date" });
    return;
  }

  const adminName =
    `${req.user?.firstName ?? ""} ${req.user?.lastName ?? ""}`.trim() ||
    req.user?.id ||
    "Admin";
  const now = new Date();
  const [inserted] = await db
    .insert(overtimeLogsTable)
    .values({
      employeeId,
      periodDate,
      plannedStartTime,
      plannedEndTime,
      otReason: otReason?.trim() || "Admin-assigned overtime",
      assignmentSource: "admin_assignment",
      status: "ot_approved",
      approvedBy: req.user!.id,
      approvedByName: adminName,
      approvalTimestamp: now,
    })
    .returning();

  res.status(201).json(serializeOTLog(inserted!));
});

// POST /admin/overtime/manual-record
// Field-work entry does not require an office QR proof.
router.post("/admin/overtime/manual-record", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const parsed = ManuallyRecordOvertimeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", details: parsed.error.flatten() });
    return;
  }
  const periodDate = toISODate(parsed.data.periodDate);
  const { employeeId, otInTime, otOutTime, otReason } = parsed.data;
  if (timeToMinutes(otOutTime) <= timeToMinutes(otInTime)) {
    res.status(400).json({ error: "OT time-out must be later than OT time-in" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId));
  if (!employee || employee.employmentStatus !== "active") {
    res.status(404).json({ error: "Active employee not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(overtimeLogsTable)
    .where(
      and(
        eq(overtimeLogsTable.employeeId, employeeId),
        eq(overtimeLogsTable.periodDate, periodDate),
      ),
    );
  if (existing) {
    res.status(409).json({
      error: "This employee already has an overtime record for that date",
    });
    return;
  }

  const adminName =
    `${req.user?.firstName ?? ""} ${req.user?.lastName ?? ""}`.trim() ||
    req.user?.id ||
    "Admin";
  const now = new Date();
  const actualIn = new Date(`${periodDate}T${otInTime}:00+08:00`);
  const actualOut = new Date(`${periodDate}T${otOutTime}:00+08:00`);
  const [inserted] = await db
    .insert(overtimeLogsTable)
    .values({
      employeeId,
      periodDate,
      otReason: otReason?.trim() || "Field work overtime",
      assignmentSource: "admin_manual",
      status: "ot_completed_pending_review",
      otInTime: actualIn,
      otOutTime: actualOut,
      approvedBy: req.user!.id,
      approvedByName: adminName,
      approvalTimestamp: now,
    })
    .returning();

  res.status(201).json(serializeOTLog(inserted!));
});

// POST /admin/overtime/scan-unauthorized
// Must be before /admin/overtime/:id routes to avoid param conflict
router.post(
  "/admin/overtime/scan-unauthorized",
  async (req: Request, res: Response) => {
    if (!(await assertAdmin(req, res))) return;

    if (unauthorizedScanInFlight) {
      res.json(await unauthorizedScanInFlight);
      return;
    }

    const scanPromise = (async () => {
      // Scan last 90 days of attendance logs with a clock-out time
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split("T")[0];

      const logs = await db
        .select()
        .from(attendanceLogsTable)
        .where(
          and(
            gte(attendanceLogsTable.date, ninetyDaysAgoStr),
            // Has clocked out
            // clockOutAt IS NOT NULL — use isNull negation approach
          ),
        );

      const eligibleLogs = logs.filter((l) => l.clockOutAt !== null);

      let created = 0;

      for (const log of eligibleLogs) {
        if (!log.clockOutAt) continue;

        const phtHour = getPHTHour(log.clockOutAt);
        if (phtHour < 17) continue; // Not past 5 PM PHT

        // Check if any OT log exists for this employee + date
        const [existing] = await db
          .select()
          .from(overtimeLogsTable)
          .where(
            and(
              eq(overtimeLogsTable.employeeId, log.employeeId),
              eq(overtimeLogsTable.periodDate, log.date),
            ),
          );

        if (existing) continue;

        await db.insert(overtimeLogsTable).values({
          employeeId: log.employeeId,
          periodDate: log.date,
          attendanceLogId: log.id,
          status: "unauthorized_ot",
          otReason: `Auto-detected: clocked out at ${log.clockOutAt.toISOString()} (PHT hour ${phtHour})`,
        });
        created++;
      }

      return { created };
    })();

    unauthorizedScanInFlight = scanPromise;
    try {
      res.json(await scanPromise);
    } finally {
      if (unauthorizedScanInFlight === scanPromise) {
        unauthorizedScanInFlight = null;
      }
    }
  },
);

// PATCH /admin/overtime/:id/approve
router.patch(
  "/admin/overtime/:id/approve",
  async (req: Request, res: Response) => {
    if (!(await assertAdmin(req, res))) return;

    const id = String(req.params["id"]);
    const [row] = await db
      .select()
      .from(overtimeLogsTable)
      .where(eq(overtimeLogsTable.id, id));

    if (!row) {
      res.status(404).json({ error: "OT log not found" });
      return;
    }

    if (!["ot_requested", "unauthorized_ot"].includes(row.status)) {
      res.status(400).json({
        error: `Cannot approve — status is "${row.status}"`,
      });
      return;
    }

    const adminName =
      `${req.user?.firstName ?? ""} ${req.user?.lastName ?? ""}`.trim() ||
      req.user?.id ||
      "Admin";

    const [updated] = await db
      .update(overtimeLogsTable)
      .set({
        status: "ot_approved",
        approvedBy: req.user!.id,
        approvedByName: adminName,
        approvalTimestamp: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(overtimeLogsTable.id, id))
      .returning();

    res.json(serializeOTLog(updated!));
  },
);

// PATCH /admin/overtime/:id/reject
router.patch(
  "/admin/overtime/:id/reject",
  async (req: Request, res: Response) => {
    if (!(await assertAdmin(req, res))) return;

    const id = String(req.params["id"]);
    const [row] = await db
      .select()
      .from(overtimeLogsTable)
      .where(eq(overtimeLogsTable.id, id));

    if (!row) {
      res.status(404).json({ error: "OT log not found" });
      return;
    }

    const parsed = RejectOvertimeBody.safeParse(req.body);
    const adminNotes = parsed.success ? (parsed.data.adminNotes ?? null) : null;

    const [updated] = await db
      .update(overtimeLogsTable)
      .set({
        status: "ot_rejected",
        adminNotes,
        updatedAt: new Date(),
      })
      .where(eq(overtimeLogsTable.id, id))
      .returning();

    res.json(serializeOTLog(updated!));
  },
);

// PATCH /admin/overtime/:id/review
router.patch(
  "/admin/overtime/:id/review",
  async (req: Request, res: Response) => {
    if (!(await assertAdmin(req, res))) return;

    const id = String(req.params["id"]);
    const [row] = await db
      .select()
      .from(overtimeLogsTable)
      .where(eq(overtimeLogsTable.id, id));

    if (!row) {
      res.status(404).json({ error: "OT log not found" });
      return;
    }

    if (row.status !== "ot_completed_pending_review") {
      res.status(400).json({
        error: `Cannot review — status is "${row.status}"`,
      });
      return;
    }

    const parsed = ReviewOvertimeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation error", details: parsed.error.flatten() });
      return;
    }

    const { approvedOvertimeHours, adminNotes } = parsed.data;

    const [updated] = await db
      .update(overtimeLogsTable)
      .set({
        status: "ot_completed",
        approvedOvertimeHours: approvedOvertimeHours.toFixed(2),
        adminNotes: adminNotes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(overtimeLogsTable.id, id))
      .returning();

    res.json(serializeOTLog(updated!));
  },
);

router.patch(
  "/admin/overtime/:id/void",
  async (req: Request, res: Response) => {
    if (!(await assertAdmin(req, res))) return;

    const parsed = VoidOvertimeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "A reason is required to void overtime" });
      return;
    }

    const id = String(req.params["id"]);
    const [row] = await db
      .select()
      .from(overtimeLogsTable)
      .where(eq(overtimeLogsTable.id, id));
    if (!row) {
      res.status(404).json({ error: "OT log not found" });
      return;
    }
    if (!["ot_approved", "ot_in_progress", "ot_completed_pending_review"].includes(row.status)) {
      res.status(400).json({ error: `Cannot void — status is "${row.status}"` });
      return;
    }

    const adminName =
      `${req.user?.firstName ?? ""} ${req.user?.lastName ?? ""}`.trim() ||
      req.user?.id ||
      "Admin";
    const now = new Date();
    const [updated] = await db
      .update(overtimeLogsTable)
      .set({
        status: "ot_voided",
        approvedOvertimeHours: "0.00",
        adminNotes: parsed.data.reason.trim(),
        voidedBy: req.user!.id,
        voidedByName: adminName,
        voidedAt: now,
        updatedAt: now,
      })
      .where(eq(overtimeLogsTable.id, id))
      .returning();

    res.json(serializeOTLog(updated!));
  },
);

router.patch(
  "/admin/overtime/:id/correct-time-out",
  async (req: Request, res: Response) => {
    if (!(await assertAdmin(req, res))) return;
    const parsed = CorrectOvertimeTimeOutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "A valid OT time-out and correction reason are required" });
      return;
    }
    const id = String(req.params["id"]);
    const [row] = await db.select().from(overtimeLogsTable).where(eq(overtimeLogsTable.id, id));
    if (!row) {
      res.status(404).json({ error: "OT log not found" });
      return;
    }
    if (row.status !== "ot_in_progress" || row.otOutTime) {
      res.status(400).json({ error: `Cannot correct OT time-out — status is "${row.status}"` });
      return;
    }
    const correctedOut = new Date(`${row.periodDate}T${parsed.data.otOutTime}:00+08:00`);
    if (!row.otInTime || correctedOut <= row.otInTime) {
      res.status(400).json({ error: "OT time-out must be later than OT time-in" });
      return;
    }
    const adminName =
      `${req.user?.firstName ?? ""} ${req.user?.lastName ?? ""}`.trim() ||
      req.user?.id ||
      "Admin";
    const updated = await db.transaction(async (tx) => {
      await tx.insert(overtimeCorrectionsTable).values({
        overtimeLogId: row.id,
        action: "correct_time_out",
        originalOtInTime: row.otInTime,
        originalOtOutTime: row.otOutTime,
        correctedOtInTime: row.otInTime,
        correctedOtOutTime: correctedOut,
        reason: parsed.data.reason.trim(),
        adminId: req.user!.id,
        adminName,
      });
      const [result] = await tx
        .update(overtimeLogsTable)
        .set({
          otOutTime: correctedOut,
          status: "ot_completed_pending_review",
          adminNotes: parsed.data.reason.trim(),
          updatedAt: new Date(),
        })
        .where(eq(overtimeLogsTable.id, row.id))
        .returning();
      return result!;
    });
    res.json(serializeOTLog(updated));
  },
);

export default router;
