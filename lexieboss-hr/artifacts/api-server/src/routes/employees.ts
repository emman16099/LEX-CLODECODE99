import { Router, type IRouter, type Request, type Response } from "express";
import { db, employeesTable, appUsersTable, usersTable } from "@workspace/db";
import { eq, ilike, or, and } from "drizzle-orm";
import { CreateEmployeeBody, UpdateEmployeeBody, SetEmployeeCredentialsBody } from "@workspace/api-zod";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}

async function getAppUser(replitId: string) {
  const [appUser] = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.replitId, replitId));
  return appUser;
}

async function assertAdmin(req: Request, res: Response): Promise<boolean> {
  if (!requireAdmin(req, res)) return false;
  const appUser = await getAppUser(req.user!.id);
  if (!appUser || appUser.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
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

function isDuplicateEmployeeCodeError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: string; constraint?: string; cause?: unknown };
    if (
      candidate.code === "23505"
      && candidate.constraint === "employees_employee_code_unique"
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

router.get("/employees", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const { status, search } = req.query as { status?: string; search?: string };

  const conditions = [];
  if (status) {
    conditions.push(eq(employeesTable.employmentStatus, status as "active" | "inactive" | "terminated"));
  }
  if (search) {
    conditions.push(
      or(
        ilike(employeesTable.firstName, `%${search}%`),
        ilike(employeesTable.lastName, `%${search}%`),
        ilike(employeesTable.employeeCode, `%${search}%`),
      ),
    );
  }

  const rows = conditions.length
    ? await db.select().from(employeesTable).where(and(...conditions))
    : await db.select().from(employeesTable);

  res.json(rows.map(serializeEmployee));
});

router.post("/employees", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingEmployee] = await db
    .select({ id: employeesTable.id })
    .from(employeesTable)
    .where(eq(employeesTable.employeeCode, parsed.data.employeeCode));
  if (existingEmployee) {
    res.status(409).json({
      error: `Employee code ${parsed.data.employeeCode} already exists. Use a different employee code.`,
    });
    return;
  }

  try {
    const [employee] = await db
      .insert(employeesTable)
      .values({
        employeeCode: parsed.data.employeeCode,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        mobileNumber: parsed.data.mobileNumber,
        address: parsed.data.address,
        hireDate: parsed.data.hireDate instanceof Date
          ? parsed.data.hireDate.toISOString().split("T")[0]
          : parsed.data.hireDate,
        employmentStatus: parsed.data.employmentStatus,
        dailyRate: parsed.data.dailyRate,
        mondayRate: parsed.data.mondayRate ?? null,
        tuesdayRate: parsed.data.tuesdayRate ?? null,
        wednesdayRate: parsed.data.wednesdayRate ?? null,
        thursdayRate: parsed.data.thursdayRate ?? null,
        fridayRate: parsed.data.fridayRate ?? null,
        saturdayRate: parsed.data.saturdayRate ?? null,
        sundayRate: parsed.data.sundayRate ?? null,
        overtimeRate: parsed.data.overtimeRate ?? null,
        sssNumber: parsed.data.sssNumber,
        philhealthNumber: parsed.data.philhealthNumber,
        pagibigNumber: parsed.data.pagibigNumber,
      })
      .returning();

    res.status(201).json(serializeEmployee(employee));
  } catch (error) {
    if (isDuplicateEmployeeCodeError(error)) {
      res.status(409).json({
        error: `Employee code ${parsed.data.employeeCode} already exists. Use a different employee code.`,
      });
      return;
    }
    throw error;
  }
});

router.get("/employees/:id", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, String(req.params.id)));

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  res.json(serializeEmployee(employee));
});

router.patch("/employees/:id", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const parsed = UpdateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.employeeCode !== undefined) updateData.employeeCode = d.employeeCode;
  if (d.firstName !== undefined) updateData.firstName = d.firstName;
  if (d.lastName !== undefined) updateData.lastName = d.lastName;
  if (d.mobileNumber !== undefined) updateData.mobileNumber = d.mobileNumber;
  if (d.address !== undefined) updateData.address = d.address;
  if (d.hireDate !== undefined) updateData.hireDate = d.hireDate;
  if (d.employmentStatus !== undefined) updateData.employmentStatus = d.employmentStatus;
  if (d.dailyRate !== undefined) updateData.dailyRate = d.dailyRate;
  if (d.mondayRate !== undefined) updateData.mondayRate = d.mondayRate;
  if (d.tuesdayRate !== undefined) updateData.tuesdayRate = d.tuesdayRate;
  if (d.wednesdayRate !== undefined) updateData.wednesdayRate = d.wednesdayRate;
  if (d.thursdayRate !== undefined) updateData.thursdayRate = d.thursdayRate;
  if (d.fridayRate !== undefined) updateData.fridayRate = d.fridayRate;
  if (d.saturdayRate !== undefined) updateData.saturdayRate = d.saturdayRate;
  if (d.sundayRate !== undefined) updateData.sundayRate = d.sundayRate;
  if (d.overtimeRate !== undefined) updateData.overtimeRate = d.overtimeRate;
  if (d.sssNumber !== undefined) updateData.sssNumber = d.sssNumber;
  if (d.philhealthNumber !== undefined) updateData.philhealthNumber = d.philhealthNumber;
  if (d.pagibigNumber !== undefined) updateData.pagibigNumber = d.pagibigNumber;

  let updated: typeof employeesTable.$inferSelect | undefined;
  try {
    [updated] = await db
      .update(employeesTable)
      .set(updateData)
      .where(eq(employeesTable.id, String(req.params.id)))
      .returning();
  } catch (error) {
    if (isDuplicateEmployeeCodeError(error)) {
      res.status(409).json({
        error: `Employee code ${d.employeeCode} already exists. Use a different employee code.`,
      });
      return;
    }
    throw error;
  }

  if (!updated) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  res.json(serializeEmployee(updated));
});

router.delete("/employees/:id", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  await db
    .update(employeesTable)
    .set({ employmentStatus: "terminated" })
    .where(eq(employeesTable.id, String(req.params.id)));

  res.status(204).send();
});

router.post("/employees/:id/credentials", async (req: Request, res: Response) => {
  if (!(await assertAdmin(req, res))) return;

  const parsed = SetEmployeeCredentialsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const employeeId = String(req.params.id);
  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId));

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const { username, password } = parsed.data;
  const hash = await bcrypt.hash(password, 12);

  await db
    .update(employeesTable)
    .set({ portalUsername: username, portalPasswordHash: hash })
    .where(eq(employeesTable.id, employeeId));

  await db
    .insert(usersTable)
    .values({
      id: employeeId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: null,
      profileImageUrl: null,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { firstName: employee.firstName, lastName: employee.lastName, updatedAt: new Date() },
    });

  await db
    .insert(appUsersTable)
    .values({
      replitId: employeeId,
      replitUsername: username,
      role: "employee",
      employeeId,
    })
    .onConflictDoUpdate({
      target: appUsersTable.replitId,
      set: { replitUsername: username, employeeId, updatedAt: new Date() },
    });

  res.json({ success: true, username });
});

export default router;
