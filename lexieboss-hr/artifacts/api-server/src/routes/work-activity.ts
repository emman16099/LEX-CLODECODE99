import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, appUsersTable, employeesTable, workActivityLogsTable } from "@workspace/db";
import { CreateMyWorkActivityLogBody, UpdateMyWorkActivityLogBody } from "@workspace/api-zod";

const manilaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
});

type Log = typeof workActivityLogsTable.$inferSelect;
type Employee = typeof employeesTable.$inferSelect;

function logJson(log: Log, employee?: Employee) {
  return {
    ...log,
    employee: employee ? {
      id: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
    } : null,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
  };
}

// Check the original calendar string before Zod coerces it to a Date.
function dateError(value: unknown, now: Date): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Use a date in YYYY-MM-DD format";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return "Enter a valid calendar date";
  if (value > manilaDay.format(now)) return "Events and accomplishments cannot be logged for a future date";
  return null;
}

function normalizeBody(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return {};
  const data = body as Record<string, unknown>;
  return {
    ...data,
    ...(typeof data.title === "string" ? { title: data.title.trim() } : {}),
    ...(typeof data.details === "string" ? { details: data.details.trim() } : {}),
  };
}

export function createWorkActivityRouter(database: typeof db = db, now: () => Date = () => new Date()): IRouter {
  const router: IRouter = Router();

  async function authorize(req: Request, res: Response, role: "admin" | "employee") {
    if (!req.isAuthenticated()) { res.status(401).json({ error: "Not authenticated" }); return null; }
    const [user] = await database.select().from(appUsersTable).where(eq(appUsersTable.replitId, req.user!.id));
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return null; }
    if (user.role !== role || (role === "employee" && !user.employeeId)) {
      res.status(403).json({ error: role === "admin" ? "Admin access required" : "Employee access required" });
      return null;
    }
    return user;
  }

  async function serializeLogs(logs: Log[]) {
    if (!logs.length) return [];
    const ids = [...new Set(logs.map((log) => log.employeeId))];
    const employees = await database.select().from(employeesTable).where(inArray(employeesTable.id, ids));
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    return logs.map((log) => logJson(log, employeeById.get(log.employeeId)));
  }

  router.get("/work/activity-logs", async (req, res): Promise<void> => {
    if (!(await authorize(req, res, "admin"))) return;
    const employeeId = req.query?.employeeId;
    if (employeeId !== undefined && (typeof employeeId !== "string" || !employeeId.trim() || employeeId.length > 200)) {
      res.status(400).json({ error: "Choose a valid employee" }); return;
    }
    const logs = await database.select().from(workActivityLogsTable)
      .where(typeof employeeId === "string" ? eq(workActivityLogsTable.employeeId, employeeId.trim()) : undefined)
      .orderBy(desc(workActivityLogsTable.activityDate), desc(workActivityLogsTable.createdAt), desc(workActivityLogsTable.id)).limit(200);
    res.json(await serializeLogs(logs));
  });

  router.get("/work/my/activity-logs", async (req, res): Promise<void> => {
    const user = await authorize(req, res, "employee");
    if (!user) return;
    const logs = await database.select().from(workActivityLogsTable)
      .where(eq(workActivityLogsTable.employeeId, user.employeeId!))
      .orderBy(desc(workActivityLogsTable.activityDate), desc(workActivityLogsTable.createdAt), desc(workActivityLogsTable.id)).limit(200);
    res.json(await serializeLogs(logs));
  });

  router.post("/work/my/activity-logs", async (req, res): Promise<void> => {
    const user = await authorize(req, res, "employee");
    if (!user) return;
    const body = normalizeBody(req.body);
    const invalidDate = dateError(body.activityDate, now());
    if (invalidDate) { res.status(400).json({ error: invalidDate }); return; }
    const parsed = CreateMyWorkActivityLogBody.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Enter a type, a title of 1–200 characters, and details of up to 2,000 characters" }); return; }
    const [log] = await database.insert(workActivityLogsTable).values({
      employeeId: user.employeeId!,
      activityDate: body.activityDate as string,
      kind: parsed.data.kind,
      title: parsed.data.title,
      details: parsed.data.details ?? "",
    }).returning();
    res.status(201).json((await serializeLogs([log]))[0]);
  });

  router.patch("/work/my/activity-logs/:id", async (req, res): Promise<void> => {
    const user = await authorize(req, res, "employee");
    if (!user) return;
    const body = normalizeBody(req.body);
    if (body.activityDate !== undefined) {
      const invalidDate = dateError(body.activityDate, now());
      if (invalidDate) { res.status(400).json({ error: invalidDate }); return; }
    }
    const parsed = UpdateMyWorkActivityLogBody.safeParse(body);
    if (!parsed.success) { res.status(400).json({ error: "Enter a valid type, title, and details" }); return; }
    const patch = {
      ...(body.activityDate !== undefined ? { activityDate: body.activityDate as string } : {}),
      ...(parsed.data.kind !== undefined ? { kind: parsed.data.kind } : {}),
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.details !== undefined ? { details: parsed.data.details } : {}),
    };
    if (!Object.keys(patch).length) { res.status(400).json({ error: "Provide at least one field to update" }); return; }
    const [log] = await database.update(workActivityLogsTable).set(patch).where(and(
      eq(workActivityLogsTable.id, String(req.params.id)),
      eq(workActivityLogsTable.employeeId, user.employeeId!),
    )).returning();
    if (!log) { res.status(404).json({ error: "Work log not found" }); return; }
    res.json((await serializeLogs([log]))[0]);
  });

  router.delete("/work/my/activity-logs/:id", async (req, res): Promise<void> => {
    const user = await authorize(req, res, "employee");
    if (!user) return;
    const [log] = await database.delete(workActivityLogsTable).where(and(
      eq(workActivityLogsTable.id, String(req.params.id)),
      eq(workActivityLogsTable.employeeId, user.employeeId!),
    )).returning();
    if (!log) { res.status(404).json({ error: "Work log not found" }); return; }
    res.status(204).send();
  });

  return router;
}

export default createWorkActivityRouter();