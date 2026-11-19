import { Router, type IRouter, type Request, type Response } from "express";
import { db, attendanceRulesTable, appUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateAttendanceRuleBody, UpdateAttendanceRuleBody } from "@workspace/api-zod";

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

function serializeRule(r: typeof attendanceRulesTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    shiftStart: r.shiftStart,
    shiftEnd: r.shiftEnd,
    lateCutoff: r.lateCutoff,
    graceMinutes: r.graceMinutes,
    clockOutGraceMinutes: r.clockOutGraceMinutes,
    breakMinutes: r.breakMinutes,
    lateDeductionMode: r.lateDeductionMode,
    lateDeductionValue: r.lateDeductionValue ?? null,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/attendance-rules", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db.select().from(attendanceRulesTable);
  res.json(rows.map(serializeRule));
});

router.post("/attendance-rules", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const parsed = CreateAttendanceRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [rule] = await db
    .insert(attendanceRulesTable)
    .values({
      name: parsed.data.name,
      shiftStart: parsed.data.shiftStart,
      shiftEnd: parsed.data.shiftEnd,
      lateCutoff: parsed.data.lateCutoff,
      graceMinutes: parsed.data.graceMinutes,
      clockOutGraceMinutes: parsed.data.clockOutGraceMinutes,
      breakMinutes: parsed.data.breakMinutes,
      lateDeductionMode: parsed.data.lateDeductionMode,
      lateDeductionValue: parsed.data.lateDeductionValue ?? undefined,
      isActive: parsed.data.isActive,
    })
    .returning();

  res.status(201).json(serializeRule(rule));
});

router.get("/attendance-rules/:id", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const [rule] = await db
    .select()
    .from(attendanceRulesTable)
    .where(eq(attendanceRulesTable.id, String(req.params.id)));

  if (!rule) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }

  res.json(serializeRule(rule));
});

router.patch("/attendance-rules/:id", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const parsed = UpdateAttendanceRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) updateData.name = d.name;
  if (d.shiftStart !== undefined) updateData.shiftStart = d.shiftStart;
  if (d.shiftEnd !== undefined) updateData.shiftEnd = d.shiftEnd;
  if (d.lateCutoff !== undefined) updateData.lateCutoff = d.lateCutoff;
  if (d.graceMinutes !== undefined) updateData.graceMinutes = d.graceMinutes;
  if (d.clockOutGraceMinutes !== undefined) updateData.clockOutGraceMinutes = d.clockOutGraceMinutes;
  if (d.breakMinutes !== undefined) updateData.breakMinutes = d.breakMinutes;
  if (d.lateDeductionMode !== undefined) updateData.lateDeductionMode = d.lateDeductionMode;
  if (d.lateDeductionValue !== undefined) updateData.lateDeductionValue = d.lateDeductionValue;
  if (d.isActive !== undefined) updateData.isActive = d.isActive;

  const [updated] = await db
    .update(attendanceRulesTable)
    .set(updateData)
    .where(eq(attendanceRulesTable.id, String(req.params.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }

  res.json(serializeRule(updated));
});

router.delete("/attendance-rules/:id", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  await db
    .delete(attendanceRulesTable)
    .where(eq(attendanceRulesTable.id, String(req.params.id)));

  res.status(204).send();
});

export default router;
