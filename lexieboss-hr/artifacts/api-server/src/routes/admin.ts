import { Router, type IRouter, type Request, type Response } from "express";
import { db, employeesTable, appUsersTable, sessionsTable, attendanceLogsTable, attendanceRulesTable, attendanceSummariesTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

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

router.get("/admin/db-stats", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const [empCount] = await db.select({ count: sql<number>`count(*)` }).from(employeesTable);
  const [appUserCount] = await db.select({ count: sql<number>`count(*)` }).from(appUsersTable);
  const [sessionCount] = await db.select({ count: sql<number>`count(*)` }).from(sessionsTable);
  const [logCount] = await db.select({ count: sql<number>`count(*)` }).from(attendanceLogsTable);
  const [ruleCount] = await db.select({ count: sql<number>`count(*)` }).from(attendanceRulesTable);
  const [summaryCount] = await db.select({ count: sql<number>`count(*)` }).from(attendanceSummariesTable);
  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);

  const employees = await db
    .select()
    .from(employeesTable)
    .orderBy(employeesTable.employeeCode);

  const appUsers = await db
    .select()
    .from(appUsersTable)
    .orderBy(appUsersTable.createdAt);

  res.json({
    tables: [
      { name: "employees", count: Number(empCount?.count ?? 0) },
      { name: "app_users", count: Number(appUserCount?.count ?? 0) },
      { name: "users", count: Number(userCount?.count ?? 0) },
      { name: "sessions", count: Number(sessionCount?.count ?? 0) },
      { name: "attendance_logs", count: Number(logCount?.count ?? 0) },
      { name: "attendance_summaries", count: Number(summaryCount?.count ?? 0) },
      { name: "attendance_rules", count: Number(ruleCount?.count ?? 0) },
    ],
    employees: employees.map((e) => ({
      id: e.id,
      employeeCode: e.employeeCode,
      firstName: e.firstName,
      lastName: e.lastName,
      employmentStatus: e.employmentStatus,
      dailyRate: e.dailyRate,
      portalUsername: e.portalUsername ?? null,
      hasCredentials: !!(e.portalUsername && e.portalPasswordHash),
      createdAt: e.createdAt.toISOString(),
    })),
    appUsers: appUsers.map((u) => ({
      id: u.id,
      replitId: u.replitId,
      replitUsername: u.replitUsername ?? null,
      role: u.role,
      employeeId: u.employeeId ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  });
});

router.post("/admin/seed", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const created: string[] = [];

  const seedEmployees = [
    {
      code: "EMP-001",
      firstName: "Maria",
      lastName: "Santos",
      mobile: "09171234567",
      address: "123 Sampaguita St., Quezon City",
      hireDate: "2023-01-15",
      dailyRate: "600.00",
      sss: "34-1234567-8",
      philhealth: "0234-567890-1",
      pagibig: "1234-5678-9012",
      username: "maria.santos",
      password: "2024",
    },
    {
      code: "EMP-002",
      firstName: "Juan",
      lastName: "Dela Cruz",
      mobile: "09189876543",
      address: "456 Malvar Ave., Caloocan City",
      hireDate: "2023-03-01",
      dailyRate: "550.00",
      sss: "34-9876543-2",
      philhealth: "0298-765432-1",
      pagibig: "9876-5432-1098",
      username: "juan.delacruz",
      password: "2024",
    },
  ];

  for (const seed of seedEmployees) {
    const existing = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.employeeCode, seed.code));

    if (existing.length > 0) {
      continue;
    }

    const hash = await bcrypt.hash(seed.password, 12);

    const [emp] = await db
      .insert(employeesTable)
      .values({
        employeeCode: seed.code,
        firstName: seed.firstName,
        lastName: seed.lastName,
        mobileNumber: seed.mobile,
        address: seed.address,
        hireDate: seed.hireDate,
        employmentStatus: "active",
        dailyRate: seed.dailyRate,
        sssNumber: seed.sss,
        philhealthNumber: seed.philhealth,
        pagibigNumber: seed.pagibig,
        portalUsername: seed.username,
        portalPasswordHash: hash,
      })
      .returning();

    await db
      .insert(usersTable)
      .values({
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: null,
        profileImageUrl: null,
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: { firstName: emp.firstName, lastName: emp.lastName, updatedAt: new Date() },
      });

    await db
      .insert(appUsersTable)
      .values({
        replitId: emp.id,
        replitUsername: seed.username,
        role: "employee",
        employeeId: emp.id,
      })
      .onConflictDoUpdate({
        target: appUsersTable.replitId,
        set: { replitUsername: seed.username, employeeId: emp.id, updatedAt: new Date() },
      });

    created.push(`${seed.firstName} ${seed.lastName} (${seed.username} / ${seed.password})`);
  }

  res.json({
    created,
    skipped: seedEmployees.length - created.length,
    message: created.length
      ? `Created ${created.length} employee(s): ${created.join(", ")}`
      : "All seed employees already exist.",
  });
});

export default router;
