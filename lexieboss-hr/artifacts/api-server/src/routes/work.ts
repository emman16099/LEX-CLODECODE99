import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  appUsersTable,
  employeesTable,
  attendanceSummariesTable,
  workJobsTable,
  workJobDailyCompletionsTable,
  workItemsTable,
  employeeDailyTasksTable,
  employeeDailyTaskCompletionsTable,
} from "@workspace/db";
import { and, asc, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import {
  CreateJobBody,
  CreateWorkItemBody,
  CreateDailyTaskBody,
  UpdateJobBody,
  UpdateWorkItemBody,
  UpdateDailyTaskBody,
} from "@workspace/api-zod";

const statuses = ["not_started", "in_progress", "blocked", "done"] as const;
function dateString(value: string | Date | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

async function currentUser(req: Request, database: typeof db) {
  if (!req.isAuthenticated()) return null;
  const [user] = await database.select().from(appUsersTable).where(eq(appUsersTable.replitId, req.user!.id));
  return user ?? null;
}

async function admin(req: Request, res: Response, database: typeof db) {
  const user = await currentUser(req, database);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return null; }
  if (user.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return null; }
  return user;
}

async function employee(req: Request, res: Response, database: typeof db) {
  const user = await currentUser(req, database);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return null; }
  if (user.role !== "employee" || !user.employeeId) { res.status(403).json({ error: "Employee access required" }); return null; }
  return user;
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

const manilaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function todayInManila(now = new Date()): string {
  return manilaDateFormatter.format(now);
}

function datesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function mondayOfWeek(date: string): string {
  const cursor = new Date(`${date}T00:00:00Z`);
  const daysSinceMonday = (cursor.getUTCDay() + 6) % 7;
  cursor.setUTCDate(cursor.getUTCDate() - daysSinceMonday);
  return cursor.toISOString().slice(0, 10);
}

function validateJobDateRange(startDate: Date | string | null | undefined, endDate: Date | string | null | undefined): string | null {
  if (!startDate || !endDate) return "Job start date and end date are required";
  if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
    return "Job start date cannot be after the end date";
  }
  return null;
}

function jobJson(
  o: typeof workJobsTable.$inferSelect,
  e?: typeof employeesTable.$inferSelect,
  dailyCompleted = false,
  completionDate = todayInManila(),
) {
  const startDate = o.startDate ?? dateOnly(o.createdAt);
  const endDate = o.endDate ?? startDate;
  return {
    id: o.id,
    jobId: o.jobId,
    clientName: o.clientName,
    brief: o.brief,
    priority: o.priority,
    status: o.status,
    assigneeId: o.assigneeId,
    assignee: e ? { id: e.id, employeeCode: e.employeeCode, firstName: e.firstName, lastName: e.lastName } : null,
    startDate,
    endDate,
    dailyCompleted,
    completionDate,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

async function dailyCompletionsForJobs(
  database: typeof db,
  jobIds: string[],
  completionDate: string,
) {
  if (jobIds.length === 0) return new Set<string>();
  const completions = await database.select().from(workJobDailyCompletionsTable).where(and(
    inArray(workJobDailyCompletionsTable.jobId, jobIds),
    eq(workJobDailyCompletionsTable.completionDate, completionDate),
  ));
  const jobIdSet = new Set(jobIds);
  return new Set(completions
    .filter((completion) => jobIdSet.has(completion.jobId) && completion.completionDate === completionDate)
    .map((completion) => completion.jobId));
}
function itemJson(i: typeof workItemsTable.$inferSelect, e?: typeof employeesTable.$inferSelect) {
  return { ...i, assignee: e ? { id: e.id, employeeCode: e.employeeCode, firstName: e.firstName, lastName: e.lastName } : null, createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt.toISOString() };
}
function taskJson(t: typeof employeeDailyTasksTable.$inferSelect, e?: typeof employeesTable.$inferSelect, asOfDate = todayInManila()) {
  return {
    ...t,
    completed: t.repeatDaily ? t.completedOn === asOfDate : t.completed,
    employee: e ? { id: e.id, employeeCode: e.employeeCode, firstName: e.firstName, lastName: e.lastName } : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function createWorkRouter(database: typeof db = db, now: () => Date = () => new Date()): IRouter {
const router: IRouter = Router();

router.get(["/work/jobs", "/work/orders"], async (req, res): Promise<void> => {
  if (!(await admin(req, res, database))) return;
  const jobs = await database.select().from(workJobsTable).orderBy(desc(workJobsTable.updatedAt));
  const items = await database.select().from(workItemsTable);
  const emps = await database.select().from(employeesTable);
  const today = todayInManila(now());
  const completedJobIds = await dailyCompletionsForJobs(database, jobs.map((job) => job.id), today);
  res.json(jobs.map((job) => ({
    ...jobJson(job, emps.find((e) => e.id === job.assigneeId), completedJobIds.has(job.id), today),
    items: items.filter((i) => i.jobId === job.id).map((i) => itemJson(i, emps.find((e) => e.id === i.assigneeId))),
  })));
});

router.post(["/work/jobs", "/work/orders"], async (req, res): Promise<void> => {
  if (!(await admin(req, res, database))) return;
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const dateError = validateJobDateRange(parsed.data.startDate, parsed.data.endDate);
  if (dateError) { res.status(400).json({ error: dateError }); return; }
  const [assignee] = await database.select().from(employeesTable).where(eq(employeesTable.id, parsed.data.assigneeId));
  if (!assignee || assignee.employmentStatus !== "active") { res.status(400).json({ error: "Job must be assigned to an active employee" }); return; }
  const [job] = await database.insert(workJobsTable).values({
    jobId: parsed.data.jobId,
    clientName: parsed.data.clientName,
    brief: parsed.data.brief,
    priority: parsed.data.priority,
    status: parsed.data.status,
    assigneeId: parsed.data.assigneeId,
    startDate: dateString(parsed.data.startDate)!,
    endDate: dateString(parsed.data.endDate)!,
  }).returning();
  res.status(201).json({ ...jobJson(job, assignee, false, todayInManila(now())), items: [] });
});

router.patch(["/work/jobs/:id", "/work/orders/:id"], async (req, res): Promise<void> => {
  if (!(await admin(req, res, database))) return;
  const parsed = UpdateJobBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const jobId = String(req.params.id);
  const [existing] = await database.select().from(workJobsTable).where(eq(workJobsTable.id, jobId));
  if (!existing) { res.status(404).json({ error: "Job not found" }); return; }
  const effectiveStartDate = parsed.data.startDate ?? existing.startDate ?? dateOnly(existing.createdAt);
  const effectiveEndDate = parsed.data.endDate ?? existing.endDate ?? effectiveStartDate;
  const dateError = validateJobDateRange(effectiveStartDate, effectiveEndDate);
  if (dateError) { res.status(400).json({ error: dateError }); return; }
  if (parsed.data.assigneeId !== undefined && parsed.data.assigneeId !== null) {
    const [assignee] = await database.select().from(employeesTable).where(eq(employeesTable.id, parsed.data.assigneeId));
    if (!assignee || assignee.employmentStatus !== "active") { res.status(400).json({ error: "Job must be assigned to an active employee" }); return; }
  }
  if (parsed.data.jobId !== undefined) {
    const [duplicate] = await database.select().from(workJobsTable).where(eq(workJobsTable.jobId, parsed.data.jobId));
    if (duplicate && duplicate.id !== jobId) { res.status(409).json({ error: "A job with this job ID already exists" }); return; }
  }
  const [job] = await database.update(workJobsTable).set({
    ...(parsed.data.jobId !== undefined ? { jobId: parsed.data.jobId } : {}),
    ...(parsed.data.clientName !== undefined ? { clientName: parsed.data.clientName } : {}),
    ...(parsed.data.brief !== undefined ? { brief: parsed.data.brief } : {}),
    ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    ...(parsed.data.assigneeId !== undefined ? { assigneeId: parsed.data.assigneeId } : {}),
    ...(parsed.data.startDate !== undefined ? { startDate: dateString(parsed.data.startDate) } : {}),
    ...(parsed.data.endDate !== undefined ? { endDate: dateString(parsed.data.endDate) } : {}),
  }).where(eq(workJobsTable.id, jobId)).returning();
  const [assignee] = job.assigneeId
    ? await database.select().from(employeesTable).where(eq(employeesTable.id, job.assigneeId))
    : [];
  const today = todayInManila(now());
  const completedJobIds = await dailyCompletionsForJobs(database, [job.id], today);
  res.json({ ...jobJson(job, assignee, completedJobIds.has(job.id), today), items: [] });
});

router.delete(["/work/jobs/:id", "/work/orders/:id"], async (req, res): Promise<void> => {
  if (!(await admin(req, res, database))) return;
  const jobId = String(req.params.id);
  const [existing] = await database.select().from(workJobsTable).where(eq(workJobsTable.id, jobId));
  if (!existing) { res.status(404).json({ error: "Job not found" }); return; }
  await database.delete(workJobsTable).where(eq(workJobsTable.id, jobId));
  res.status(204).send();
});

router.get("/work/jobs/:id/history", async (req, res): Promise<void> => {
  if (!(await admin(req, res, database))) return;
  const jobId = String(req.params.id);
  const [job] = await database.select().from(workJobsTable).where(eq(workJobsTable.id, jobId));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const startDate = job.startDate ?? dateOnly(job.createdAt);
  const endDate = job.endDate ?? startDate;
  const today = todayInManila(now());
  const historyEndDate = endDate < today ? endDate : today;
  const completions = await database.select().from(workJobDailyCompletionsTable)
    .where(eq(workJobDailyCompletionsTable.jobId, jobId));
  const completedDates = new Set(completions
    .filter((completion) => completion.jobId === jobId)
    .map((completion) => completion.completionDate));
  res.json(datesBetween(startDate, historyEndDate).reverse().map((date) => ({
    date,
    completed: completedDates.has(date),
  })));
});

router.post(["/work/jobs/:id/items", "/work/orders/:id/items"], async (req, res): Promise<void> => {
  if (!(await admin(req, res, database))) return;
  const parsed = CreateWorkItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [job] = await database.select().from(workJobsTable).where(eq(workJobsTable.id, String(req.params.id)));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  const [assignee] = await database.select().from(employeesTable).where(eq(employeesTable.id, parsed.data.assigneeId));
  if (!assignee || assignee.employmentStatus !== "active") { res.status(400).json({ error: "Assignee must be an active employee" }); return; }
  const [item] = await database.insert(workItemsTable).values({ ...parsed.data, dueDate: dateString(parsed.data.dueDate), jobId: job.id }).returning();
  res.status(201).json(itemJson(item, assignee));
});

router.patch("/work/items/:id", async (req, res): Promise<void> => {
  const user = await currentUser(req, database);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const parsed = UpdateWorkItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await database.select().from(workItemsTable).where(eq(workItemsTable.id, String(req.params.id)));
  if (!existing) { res.status(404).json({ error: "Work item not found" }); return; }
  if (user.role !== "admin" && existing.assigneeId !== user.employeeId) { res.status(403).json({ error: "You can only update your own work" }); return; }
  const data = user.role === "admin"
    ? { ...parsed.data, dueDate: dateString(parsed.data.dueDate) }
    : {
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.employeeNote !== undefined ? { employeeNote: parsed.data.employeeNote } : {}),
      };
  const [item] = await database.update(workItemsTable).set(data).where(eq(workItemsTable.id, existing.id)).returning();
  const [assignee] = await database.select().from(employeesTable).where(eq(employeesTable.id, item.assigneeId));
  res.json(itemJson(item, assignee));
});

router.get("/work/my", async (req, res): Promise<void> => {
  const user = await employee(req, res, database);
  if (!user) return;
  const items = await database.select().from(workItemsTable).where(eq(workItemsTable.assigneeId, user.employeeId!)).orderBy(asc(workItemsTable.dueDate));
  const today = todayInManila(now());
  const tasks = (await database.select().from(employeeDailyTasksTable).where(eq(employeeDailyTasksTable.employeeId, user.employeeId!)).orderBy(desc(employeeDailyTasksTable.taskDate), asc(employeeDailyTasksTable.createdAt)))
    .filter((task) => task.repeatDaily
      ? task.taskDate <= today
      : task.taskDate === today || (task.taskDate < today && !task.completed));
  const jobs = await database.select().from(workJobsTable).where(
    or(
      eq(workJobsTable.assigneeId, user.employeeId!),
      items.length ? inArray(workJobsTable.id, items.map((i) => i.jobId)) : sql`false`,
    ),
  );
  const emps = await database.select().from(employeesTable);
  const completedJobIds = await dailyCompletionsForJobs(database, jobs.map((job) => job.id), today);
  res.json({
    jobs: jobs.map((job) => ({
      ...jobJson(job, emps.find((e) => e.id === job.assigneeId), completedJobIds.has(job.id), today),
      items: items.filter((i) => i.jobId === job.id).map((i) => itemJson(i)),
    })),
    items: items.map((i) => itemJson(i)),
     tasks: tasks.map((t) => taskJson(t, undefined, today)),
  });
});

router.post("/work/my/jobs/:id/daily-completion", async (req, res): Promise<void> => {
  const user = await employee(req, res, database);
  if (!user) return;

  const jobId = String(req.params.id);
  const today = todayInManila(now());
  const outcome = await database.transaction(async (tx) => {
    const [job] = await tx.select().from(workJobsTable)
      .where(eq(workJobsTable.id, jobId))
      .for("update");
    if (!job) return { status: 404 as const, error: "Job not found" };
    if (job.assigneeId !== user.employeeId) {
      return { status: 403 as const, error: "You can only complete jobs assigned to you" };
    }
    if (job.status === "completed") {
      return { status: 409 as const, error: "Completed jobs cannot be marked done again" };
    }

    const startDate = job.startDate ?? dateOnly(job.createdAt);
    const endDate = job.endDate ?? startDate;
    if (today < startDate || today > endDate) {
      return { status: 400 as const, error: "Daily completion is only available within the job date range" };
    }

    await tx.insert(workJobDailyCompletionsTable).values({
      jobId,
      employeeId: user.employeeId!,
      completionDate: today,
    }).onConflictDoNothing({
      target: [workJobDailyCompletionsTable.jobId, workJobDailyCompletionsTable.completionDate],
    });
    return { status: 200 as const, job };
  });
  if ("error" in outcome) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  const [assignee] = outcome.job.assigneeId
    ? await database.select().from(employeesTable).where(eq(employeesTable.id, outcome.job.assigneeId))
    : [];
  const items = await database.select().from(workItemsTable).where(eq(workItemsTable.jobId, jobId));
  res.json({
    ...jobJson(outcome.job, assignee, true, today),
    items: items.filter((item) => item.jobId === jobId).map((item) => itemJson(item)),
  });
});

router.post("/work/my/jobs/:id/complete", async (req, res): Promise<void> => {
  const user = await employee(req, res, database);
  if (!user) return;

  const jobId = String(req.params.id);
  const [existing] = await database.select().from(workJobsTable).where(eq(workJobsTable.id, jobId));
  if (!existing) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (existing.assigneeId !== user.employeeId) {
    res.status(403).json({ error: "You can only complete jobs assigned to you" });
    return;
  }

  const [job] = await database
    .update(workJobsTable)
    .set({ status: "completed" })
    .where(eq(workJobsTable.id, jobId))
    .returning();
  const items = await database.select().from(workItemsTable).where(eq(workItemsTable.jobId, jobId));
  const today = todayInManila(now());
  const completedJobIds = await dailyCompletionsForJobs(database, [jobId], today);
  const [assignee] = job.assigneeId
    ? await database.select().from(employeesTable).where(eq(employeesTable.id, job.assigneeId))
    : [];
  res.json({
    ...jobJson(job, assignee, completedJobIds.has(jobId), today),
    items: items.map((item) => itemJson(item)),
  });
});

router.get("/work/my/weekly-recap", async (req, res): Promise<void> => {
  const user = await employee(req, res, database);
  if (!user) return;

  const periodTo = todayInManila(now());
  const periodFrom = mondayOfWeek(periodTo);
  const allTasks = await database
    .select()
    .from(employeeDailyTasksTable)
    .where(eq(employeeDailyTasksTable.employeeId, user.employeeId!));
  const weeklyTasks = allTasks.filter((task) =>
    task.taskDate <= periodTo && (task.repeatDaily || task.taskDate >= periodFrom),
  );
  const recurringTasks = weeklyTasks.filter((task) => task.repeatDaily);
  const completions = recurringTasks.length
    ? await database
      .select()
      .from(employeeDailyTaskCompletionsTable)
      .where(and(
        inArray(employeeDailyTaskCompletionsTable.taskId, recurringTasks.map((task) => task.id)),
        gte(employeeDailyTaskCompletionsTable.completionDate, periodFrom),
        lte(employeeDailyTaskCompletionsTable.completionDate, periodTo),
      ))
    : [];
  const completionByDate = new Map(
    completions.map((completion) => [`${completion.taskId}:${completion.completionDate}`, completion.completed]),
  );

  let plannedCount = 0;
  let completedCount = 0;
  let missedCount = 0;
  let openCount = 0;
  for (const task of weeklyTasks) {
    if (!task.repeatDaily) {
      plannedCount += 1;
      if (task.completed) completedCount += 1;
      else if (task.taskDate < periodTo) missedCount += 1;
      else openCount += 1;
      continue;
    }

    const taskStart = task.taskDate > periodFrom ? task.taskDate : periodFrom;
    for (const date of datesBetween(taskStart, periodTo)) {
      plannedCount += 1;
      const completed = completionByDate.get(`${task.id}:${date}`) ?? task.completedOn === date;
      if (completed) completedCount += 1;
      else if (date < periodTo) missedCount += 1;
      else openCount += 1;
    }
  }

  const jobItems = await database
    .select()
    .from(workItemsTable)
    .where(eq(workItemsTable.assigneeId, user.employeeId!));
  const jobSummary = {
    totalCount: jobItems.length,
    doneCount: jobItems.filter((item) => item.status === "done").length,
    inProgressCount: jobItems.filter((item) => item.status === "in_progress").length,
    blockedCount: jobItems.filter((item) => item.status === "blocked").length,
    notStartedCount: jobItems.filter((item) => item.status === "not_started").length,
  };

  const summaries = await database
    .select()
    .from(attendanceSummariesTable)
    .where(and(
      eq(attendanceSummariesTable.employeeId, user.employeeId!),
      gte(attendanceSummariesTable.date, periodFrom),
      lte(attendanceSummariesTable.date, periodTo),
    ));
  const attendance = {
    employeeId: user.employeeId!,
    periodFrom,
    periodTo,
    presentCount: summaries.filter((summary) => summary.status === "present" || summary.status === "late").length,
    lateCount: summaries.filter((summary) => summary.isLate).length,
    totalLateMinutes: summaries.reduce((sum, summary) => sum + summary.lateMinutes, 0),
    totalLateDeductions: summaries.reduce((sum, summary) => sum + parseFloat(summary.lateDeductionAmount ?? "0"), 0).toFixed(2),
    totalHours: summaries.reduce((sum, summary) => sum + parseFloat(summary.regularHours ?? "0"), 0).toFixed(2),
    undertimeCount: summaries.filter((summary) => summary.undertimeMinutes > 0).length,
    totalUndertimeMinutes: summaries.reduce((sum, summary) => sum + summary.undertimeMinutes, 0),
    totalUndertimeDeductions: summaries.reduce((sum, summary) => sum + parseFloat(summary.undertimeDeductionAmount ?? "0"), 0).toFixed(2),
  };

  res.json({
    periodFrom,
    periodTo,
    tasks: { plannedCount, completedCount, missedCount, openCount },
    jobs: jobSummary,
    attendance,
  });
});

router.get("/work/tasks", async (req, res): Promise<void> => {
  if (!(await admin(req, res, database))) return;
  const tasks = await database.select().from(employeeDailyTasksTable).orderBy(desc(employeeDailyTasksTable.taskDate), desc(employeeDailyTasksTable.createdAt));
  const emps = await database.select().from(employeesTable);
  res.json(tasks.map((t) => taskJson(t, emps.find((e) => e.id === t.employeeId))));
});

router.get("/work/tasks/:id/history", async (req, res): Promise<void> => {
  if (!(await admin(req, res, database))) return;
  const taskId = String(req.params.id);
  const [task] = await database.select().from(employeeDailyTasksTable).where(eq(employeeDailyTasksTable.id, taskId));
  if (!task) { res.status(404).json({ error: "Daily task not found" }); return; }
  if (!task.repeatDaily) { res.status(400).json({ error: "Completion history is only available for recurring tasks" }); return; }

  const completions = await database.select().from(employeeDailyTaskCompletionsTable)
    .where(eq(employeeDailyTaskCompletionsTable.taskId, taskId))
    .orderBy(desc(employeeDailyTaskCompletionsTable.completionDate));
  const completionByDate = new Map(completions.map((completion) => [completion.completionDate, completion.completed]));
  res.json(datesBetween(task.taskDate, todayInManila(now())).map((date) => ({
    date,
    completed: completionByDate.get(date) ?? (task.completedOn === date),
  })).reverse());
});

router.post("/work/tasks", async (req, res): Promise<void> => {
  if (!(await admin(req, res, database))) return;
  const parsed = CreateDailyTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [assignee] = await database.select().from(employeesTable).where(eq(employeesTable.id, parsed.data.employeeId));
  if (!assignee || assignee.employmentStatus !== "active") { res.status(400).json({ error: "Task must be assigned to an active employee" }); return; }
  const [task] = await database.insert(employeeDailyTasksTable).values({ ...parsed.data, taskDate: dateString(parsed.data.taskDate)!, completedOn: null }).returning();
  res.status(201).json(taskJson(task, assignee));
});

router.patch("/work/tasks/:id", async (req, res): Promise<void> => {
  const user = await currentUser(req, database);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const parsed = UpdateDailyTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await database.select().from(employeeDailyTasksTable).where(eq(employeeDailyTasksTable.id, String(req.params.id)));
  if (!existing) { res.status(404).json({ error: "Daily task not found" }); return; }
  if (user.role !== "admin" && existing.employeeId !== user.employeeId) { res.status(403).json({ error: "You can only update your own tasks" }); return; }
  if (user.role === "admin" && parsed.data.employeeId !== undefined) {
    const [assignee] = await database.select().from(employeesTable).where(eq(employeesTable.id, parsed.data.employeeId));
    if (!assignee || assignee.employmentStatus !== "active") { res.status(400).json({ error: "Task must be assigned to an active employee" }); return; }
  }
  const today = todayInManila(now());
  const nextRepeatDaily = parsed.data.repeatDaily ?? existing.repeatDaily;
  const completionPatch = parsed.data.completed === undefined
    ? (!nextRepeatDaily && existing.repeatDaily ? { completedOn: null } : {})
    : {
        completed: parsed.data.completed,
        completedOn: nextRepeatDaily && parsed.data.completed ? today : null,
      };
  const data = user.role === "admin"
    ? {
        ...parsed.data,
        taskDate: parsed.data.taskDate ? dateString(parsed.data.taskDate)! : undefined,
        ...completionPatch,
      }
    : {
        ...(parsed.data.completed !== undefined ? { completed: parsed.data.completed } : {}),
        ...(existing.repeatDaily && parsed.data.completed !== undefined ? { completedOn: parsed.data.completed ? today : null } : {}),
        ...(parsed.data.employeeNote !== undefined ? { employeeNote: parsed.data.employeeNote } : {}),
      };
  const [task] = await database.update(employeeDailyTasksTable).set(data).where(eq(employeeDailyTasksTable.id, existing.id)).returning();
  if (existing.repeatDaily && parsed.data.completed !== undefined) {
    await database.insert(employeeDailyTaskCompletionsTable).values({
      taskId: existing.id,
      completionDate: today,
      completed: parsed.data.completed,
    }).onConflictDoUpdate({
      target: [employeeDailyTaskCompletionsTable.taskId, employeeDailyTaskCompletionsTable.completionDate],
      set: { completed: parsed.data.completed, updatedAt: new Date() },
    });
  }
  const [assignee] = await database.select().from(employeesTable).where(eq(employeesTable.id, task.employeeId));
  res.json(taskJson(task, assignee));
});

router.delete("/work/tasks/:id", async (req, res): Promise<void> => {
  if (!(await admin(req, res, database))) return;
  const taskId = String(req.params.id);
  const [existing] = await database.select().from(employeeDailyTasksTable).where(eq(employeeDailyTasksTable.id, taskId));
  if (!existing) { res.status(404).json({ error: "Daily task not found" }); return; }
  await database.delete(employeeDailyTasksTable).where(eq(employeeDailyTasksTable.id, taskId));
  res.status(204).send();
});

  return router;
}

export default createWorkRouter();