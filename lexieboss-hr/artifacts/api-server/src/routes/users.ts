import { Router, type IRouter, type Request, type Response } from "express";
import { db, appUsersTable, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/users/me", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [appUser] = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.replitId, req.user.id));

  if (!appUser) {
    res.status(404).json({ error: "User profile not found" });
    return;
  }

  const [employee] = appUser.employeeId
    ? await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.id, appUser.employeeId))
    : [];

  res.json({
    id: appUser.id,
    replitId: appUser.replitId,
    replitUsername: appUser.replitUsername ?? null,
    role: appUser.role,
    employeeId: appUser.employeeId ?? null,
    employeeProfile: employee
      ? {
          id: employee.id,
          employeeCode: employee.employeeCode,
          firstName: employee.firstName,
          lastName: employee.lastName,
          portalUsername: employee.portalUsername ?? null,
          employmentStatus: employee.employmentStatus,
          hireDate: employee.hireDate,
        }
      : null,
    createdAt: appUser.createdAt.toISOString(),
  });
});

export default router;
