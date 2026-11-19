import { expect, test, type Page, type Route } from "@playwright/test";

type Role = "admin" | "employee";
type FixtureState = {
  role: Role;
  authenticated: boolean;
  attendance: 0 | 1 | 2;
  overtimeRequested: boolean;
  overtimeAssigned: boolean;
  overtimeAssignedStarted: boolean;
  staleOvertime: boolean;
  taskCompleted: boolean;
  undertimeReviewed: boolean;
  createdJob: boolean;
  payrollPeriodId: string;
  payrollGenerated: boolean;
  payrollStatus: "draft" | "approved" | "paid";
  payrollCorrectionApplied: boolean;
  payrollCorrectionScenario: boolean;
  counts: Map<string, number>;
};

const employee = {
  id: "employee-1",
  employeeCode: "LB-001",
  firstName: "Taylor",
  lastName: "Santos",
  portalUsername: "taylor",
  employmentStatus: "active",
  hireDate: "2025-01-15",
};

const secondEmployee = {
  ...employee,
  id: "employee-2",
  employeeCode: "LB-002",
  firstName: "Morgan",
  lastName: "Reyes",
  portalUsername: "morgan",
};

const adminAuthUser = {
  id: "admin-1",
  email: "admin@example.test",
  firstName: "Lexie",
  lastName: "Boss",
  profileImageUrl: null,
};

const employeeAuthUser = {
  id: "employee-session-1",
  email: null,
  firstName: employee.firstName,
  lastName: employee.lastName,
  profileImageUrl: null,
};

const testToday = new Date().toISOString().slice(0, 10);

const attendanceRule = {
  id: "rule-1",
  name: "Regular Shift",
  shiftStart: "08:00",
  shiftEnd: "17:00",
  graceMinutes: 10,
  isActive: true,
};

const log = {
  id: "log-1",
  employeeId: employee.id,
  date: "2026-08-31",
  clockInAt: "2026-08-31T08:00:00.000Z",
  clockOutAt: "2026-08-31T17:00:00.000Z",
  clockInPhotoUrl: null,
  clockOutPhotoUrl: null,
  attendanceRuleId: attendanceRule.id,
  earlyClockOutReason: null,
  earlyClockOutNote: null,
};

const summary = {
  id: "summary-1",
  attendanceLogId: log.id,
  employeeId: employee.id,
  date: log.date,
  status: "present",
  isLate: false,
  lateMinutes: 0,
  lateDeductionAmount: "0.00",
  regularHours: "8.00",
  undertimeMinutes: 0,
  undertimeDeductionAmount: "0.00",
  undertimeStatus: null,
};

const workItem = {
  id: "item-1",
  jobId: "job-1",
  title: "Prepare client materials",
  description: "Prepare the materials for the client handoff.",
  assigneeId: employee.id,
  dueDate: "2026-08-31",
  status: "in_progress",
  employeeNote: null,
  assignee: employee,
};

const dailyTask = {
  id: "task-1",
  employeeId: employee.id,
  taskDate: "2026-08-31",
  repeatDaily: false,
  title: "Check the work area",
  description: "Complete the opening safety check.",
  completed: false,
  completedOn: null,
  employeeNote: null,
  employee,
};

const job = {
  id: "job-1",
  jobId: "JOB-001",
  clientName: "Acme Furniture",
  assigneeId: employee.id,
  brief: "Client handoff",
  priority: "normal",
  startDate: "2026-08-31",
  endDate: "2026-08-31",
  items: [workItem],
  assignee: employee,
};

function profileFor(role: Role) {
  return {
    id: role === "admin" ? "app-admin-1" : "app-employee-1",
    replitId: role === "admin" ? adminAuthUser.id : employeeAuthUser.id,
    replitUsername: role === "admin" ? "lexieboss-admin" : null,
    role,
    employeeId: role === "employee" ? employee.id : null,
    employeeProfile: role === "employee" ? employee : null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function payrollEntry(
  employeeId = employee.id,
  values: { regularPay?: string; grossPay?: string; netPay?: string } = {},
) {
  return {
    id: `entry-${employeeId}`,
    payrollPeriodId: "period-e2e",
    employeeId,
    dailyRateSnapshot: "1000.00",
    daysPresent: 1,
    daysAbsent: 0,
    lateCount: 0,
    regularPay: values.regularPay ?? "1000.00",
    lateDeductionTotal: "0.00",
    undertimeDeductionTotal: "0.00",
    overtimePay: "0.00",
    grossPay: values.grossPay ?? "1000.00",
    netPay: values.netPay ?? "1000.00",
    totalHours: "8.00",
    totalLateMinutes: 0,
    undertimeCount: 0,
    totalUndertimeMinutes: 0,
  };
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function payrollPeriod(state: FixtureState) {
  return {
    id: state.payrollPeriodId,
    startDate: "2026-08-24",
    endDate: "2026-08-30",
    status: state.payrollStatus,
    generatedAt: state.payrollGenerated ? "2026-08-31T00:00:00.000Z" : null,
    approvedAt: state.payrollStatus === "draft" ? null : "2026-08-31T00:00:00.000Z",
    paidAt: state.payrollStatus === "paid" ? "2026-08-31T00:00:00.000Z" : null,
  };
}

function payrollDetail(state: FixtureState) {
  const correctedValues = state.payrollCorrectionApplied
    ? { regularPay: "1250.00", grossPay: "1250.00", netPay: "1250.00" }
    : {};
  return {
    period: payrollPeriod(state),
    entries: state.payrollGenerated
      ? [
          { entry: payrollEntry(employee.id, correctedValues), employee },
          ...(state.payrollCorrectionScenario
            ? [{ entry: payrollEntry(secondEmployee.id), employee: secondEmployee }]
            : []),
        ]
      : [],
  };
}

function count(state: FixtureState, method: string, path: string) {
  const key = `${method} ${path}`;
  state.counts.set(key, (state.counts.get(key) ?? 0) + 1);
}

function requestCount(state: FixtureState, method: string, path: string) {
  return state.counts.get(`${method} ${path}`) ?? 0;
}

async function installFixture(page: Page, role: Role) {
  const state: FixtureState = {
    role,
    authenticated: false,
    attendance: 0,
    overtimeRequested: false,
    overtimeAssigned: false,
    overtimeAssignedStarted: false,
    staleOvertime: false,
    taskCompleted: false,
    undertimeReviewed: false,
    createdJob: false,
    payrollPeriodId: "period-e2e",
    payrollGenerated: false,
    payrollStatus: "approved",
    payrollCorrectionApplied: false,
    payrollCorrectionScenario: false,
    counts: new Map(),
  };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;
    count(state, method, path);

    if (path === "/api/auth/user" && method === "GET") {
      return json(route, { user: state.authenticated ? (role === "admin" ? adminAuthUser : employeeAuthUser) : null });
    }
    if (path === "/api/users/me" && method === "GET") {
      return state.authenticated ? json(route, profileFor(role)) : json(route, { error: "Not authenticated" }, 401);
    }
    if (path === "/api/login" && method === "GET") {
      state.authenticated = true;
      return route.fulfill({ status: 302, headers: { location: "/" } });
    }
    if (path === "/api/logout" && method === "GET") {
      state.authenticated = false;
      return route.fulfill({ status: 302, headers: { location: "/" } });
    }
    if (path === "/api/auth/gate/verify" && method === "POST") {
      return json(route, { proof: "controlled-gate-proof" });
    }
    if (path === "/api/auth/employee-login" && method === "POST") {
      state.authenticated = true;
      return json(route, { success: true });
    }
    if (path === "/api/auth/admin-login" && method === "POST") {
      state.authenticated = true;
      return json(route, { success: true });
    }

    if (!state.authenticated) {
      return json(route, { error: "Not authenticated" }, 401);
    }

    if (path === "/api/attendance/today" && method === "GET") {
      return json(route, {
        log: state.attendance === 0 ? null : {
          ...log,
          clockOutAt: state.attendance === 2 ? log.clockOutAt : null,
        },
        summary: state.attendance === 2 ? summary : null,
      });
    }
    if (path === "/api/attendance/clock-in" && method === "POST") {
      state.attendance = 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return json(route, { log: { ...log, clockOutAt: null }, summary: null });
    }
    if (path === "/api/attendance/clock-out" && method === "POST") {
      state.attendance = 2;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return json(route, { log, summary });
    }
    if (path === "/api/attendance-rules" && method === "GET") {
      return json(route, [attendanceRule]);
    }
    if (path === "/api/overtime/my-requests" && method === "GET") {
      return json(route, state.overtimeAssigned ? [{
        id: "ot-assigned-1",
        employeeId: employee.id,
        periodDate: testToday,
        status: state.overtimeAssignedStarted ? "ot_in_progress" : "ot_approved",
        otReason: "Admin-assigned production support",
        assignmentSource: "admin_assignment",
        plannedStartTime: "00:00",
        plannedEndTime: "23:59",
        otInTime: state.overtimeAssignedStarted ? new Date().toISOString() : null,
        otOutTime: null,
        approvedOvertimeHours: null,
        adminNotes: null,
      }] : state.overtimeRequested ? [{
        id: "ot-1",
        employeeId: employee.id,
        periodDate: testToday,
        status: "ot_requested",
        otReason: "Complete the client handoff",
        otInTime: null,
        otOutTime: null,
        approvedOvertimeHours: null,
        adminNotes: null,
      }] : []);
    }
    if (path === "/api/overtime/auto-start-assigned" && method === "POST") {
      const started = state.overtimeAssigned && !state.overtimeAssignedStarted;
      state.overtimeAssignedStarted = state.overtimeAssigned || state.overtimeAssignedStarted;
      return json(route, {
        started,
        overtimeLog: started ? { id: "ot-assigned-1", status: "ot_in_progress" } : null,
      });
    }
    if (path === "/api/overtime/request" && method === "POST") {
      state.overtimeRequested = true;
      return json(route, { id: "ot-1", status: "ot_requested" }, 201);
    }
    if (path === "/api/work/my" && method === "GET") {
      return json(route, {
        jobs: state.createdJob ? [job] : [job],
        items: [workItem],
        tasks: [{ ...dailyTask, completed: state.taskCompleted }],
      });
    }
    if (path === "/api/work/my/weekly-recap" && method === "GET") {
      return json(route, {
        periodFrom: "2026-08-24",
        periodTo: "2026-08-30",
        tasks: { completedCount: state.taskCompleted ? 1 : 0, plannedCount: 1, missedCount: 0 },
        jobs: { doneCount: 0, totalCount: 1, blockedCount: 0 },
        attendance: { presentCount: state.attendance === 2 ? 1 : 0, totalHours: state.attendance === 2 ? "8.0" : "0.0", lateCount: 0 },
      });
    }
    if (path === "/api/work/tasks/task-1" && method === "PATCH") {
      state.taskCompleted = true;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return json(route, { ...dailyTask, completed: true });
    }
    if (path === "/api/attendance/my-history" && method === "GET") {
      return json(route, [{ log, summary, employee: null }]);
    }
    if (path === "/api/attendance/my-stats" && method === "GET") {
      return json(route, {
        employeeId: employee.id,
        periodFrom: "2026-08-03",
        periodTo: "2026-09-01",
        presentCount: 1,
        lateCount: 0,
        totalLateMinutes: 0,
        totalLateDeductions: "0.00",
        totalHours: "8.00",
        undertimeCount: 0,
        totalUndertimeMinutes: 0,
        totalUndertimeDeductions: "0.00",
        employee,
      });
    }
    if (path === "/api/payroll/my-history" && method === "GET") {
      return json(route, [{
        entry: payrollEntry(),
        period: { ...payrollPeriod(state), status: "approved" },
      }]);
    }

    if (role === "admin") {
      if (path === "/api/attendance/summaries/today" && method === "GET") {
        return json(route, {
          totalEmployees: 2,
          presentCount: 1,
          lateCount: 0,
          absentCount: 0,
          missingLogoutCount: 1,
          lateEmployees: [],
          missingLogoutEmployees: [],
        });
      }
      if (path === "/api/attendance/stats" && method === "GET") {
        return json(route, [{
          employeeId: employee.id,
          employee,
          presentCount: 1,
          lateCount: 0,
          totalLateMinutes: 0,
          undertimeCount: 0,
          totalUndertimeMinutes: 0,
          totalLateDeductions: "0.00",
          totalUndertimeDeductions: "0.00",
          totalHours: "8.00",
        }]);
      }
      if (path === "/api/attendance/logs" && method === "GET") {
        const payrollLog = state.payrollCorrectionScenario
          ? { ...log, date: "2026-08-30" }
          : log;
        return json(route, [
          {
            employee,
            log: payrollLog,
            summary: {
              ...summary,
              date: payrollLog.date,
              dailyRateOverride: state.payrollCorrectionApplied ? "1250.00" : null,
            },
            applicableDailyRate: state.payrollCorrectionApplied ? "1250.00" : "1000.00",
            overtimeHours: "1.50",
            corrections: state.payrollCorrectionApplied
              ? [{
                  id: "correction-1",
                  field: "daily_rate",
                  previousAmount: "1000.00",
                  newAmount: "1250.00",
                  reason: "Approved daily rate correction",
                  correctedByName: "Lexie Boss",
                  createdAt: "2026-09-01T00:00:00.000Z",
                }]
              : [],
          },
        ]);
      }
      if (path === "/api/attendance/logs/log-1/correct" && method === "PATCH") {
        state.payrollCorrectionApplied = true;
        return json(route, {
          log,
          summary: { ...summary, dailyRateOverride: "1250.00" },
          corrections: [],
        });
      }
      if (path === "/api/attendance/undertime-pending" && method === "GET") {
        return json(route, state.undertimeReviewed ? [] : [{
          employee,
          log: { ...log, earlyClockOutReason: "official_errand", earlyClockOutNote: "Client visit" },
          summary: { ...summary, id: "summary-undertime", undertimeMinutes: 30, undertimeDeductionAmount: "62.50", undertimeStatus: "pending_review" },
        }]);
      }
      if (path === "/api/attendance/summaries/summary-undertime/review-undertime" && method === "PATCH") {
        state.undertimeReviewed = true;
        return json(route, { ...summary, undertimeStatus: "approved" });
      }
      if (path === "/api/employees" && method === "GET") {
        return json(route, [employee]);
      }
      if (path === "/api/admin/overtime/scan-unauthorized" && method === "POST") {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return json(route, { created: 0 });
      }
      if (path === "/api/admin/overtime/assign" && method === "POST") {
        state.overtimeAssigned = true;
        return json(route, {
          id: "ot-assigned-1",
          employeeId: employee.id,
          periodDate: testToday,
          status: "ot_approved",
          assignmentSource: "admin_assignment",
          plannedStartTime: "17:00",
          plannedEndTime: "19:00",
        }, 201);
      }
      if (path === "/api/admin/overtime/manual-record" && method === "POST") {
        return json(route, {
          id: "ot-field-1",
          employeeId: employee.id,
          periodDate: testToday,
          status: "ot_completed_pending_review",
          assignmentSource: "admin_manual",
          otReason: "Client installation at off-site location",
          otInTime: `${testToday}T09:00:00.000Z`,
          otOutTime: `${testToday}T11:00:00.000Z`,
        }, 201);
      }
      if (path === "/api/admin/overtime/ot-assigned-1/void" && method === "PATCH") {
        return json(route, {
          id: "ot-assigned-1",
          employeeId: employee.id,
          periodDate: testToday,
          status: "ot_voided",
          approvedOvertimeHours: "0.00",
          adminNotes: "Employee accidentally started OT and did not perform overtime work",
          voidedByName: "Admin User",
          voidedAt: new Date().toISOString(),
        });
      }
      if (path === "/api/admin/overtime/ot-stale-1/correct-time-out" && method === "PATCH") {
        state.staleOvertime = false;
        return json(route, {
          id: "ot-stale-1",
          employeeId: employee.id,
          periodDate: "2026-08-31",
          status: "ot_completed_pending_review",
          otInTime: "2026-08-31T03:15:00.000Z",
          otOutTime: "2026-08-31T10:00:00.000Z",
          adminNotes: "Verified with field supervisor",
        });
      }
      if (path === "/api/admin/overtime" && method === "GET") {
        if (state.staleOvertime) {
          return json(route, [{
            overtimeLog: {
              id: "ot-stale-1",
              employeeId: employee.id,
              periodDate: "2026-08-31",
              status: "ot_in_progress",
              otReason: "Extra work",
              otInTime: "2026-08-31T03:15:00.000Z",
              otOutTime: null,
              approvedByName: "Admin",
            },
            employee,
          }]);
        }
        return json(route, state.overtimeAssigned ? [{
          overtimeLog: {
            id: "ot-assigned-1",
            employeeId: employee.id,
            periodDate: testToday,
            status: "ot_approved",
            otReason: "Admin-assigned production support",
            assignmentSource: "admin_assignment",
            plannedStartTime: "17:00",
            plannedEndTime: "19:00",
            otInTime: null,
            otOutTime: null,
          },
          employee,
        }] : []);
      }
      if (path === "/api/work/jobs" && method === "GET") {
        return json(route, state.createdJob ? [job] : []);
      }
      if (path === "/api/work/jobs" && method === "POST") {
        state.createdJob = true;
        return json(route, job, 201);
      }
      if (path === "/api/payroll/periods" && method === "GET") {
        return json(route, [{
          ...payrollPeriod(state),
          id: "period-old",
          startDate: "2026-08-17",
          endDate: "2026-08-23",
          status: "approved",
          approvedAt: "2026-08-31T00:00:00.000Z",
        }, ...(state.payrollPeriodId === "period-old" ? [] : [{ ...payrollPeriod(state) }])]);
      }
      if (path === "/api/payroll/periods" && method === "POST") {
        state.payrollPeriodId = "period-e2e";
        return json(route, payrollPeriod(state), 201);
      }
      if (path === "/api/payroll/special-working-days" && method === "GET") {
        return json(route, []);
      }
      const payrollDetailMatch = path.match(/^\/api\/payroll\/periods\/([^/]+)$/);
      if (payrollDetailMatch && method === "GET") {
        state.payrollPeriodId = payrollDetailMatch[1];
        return json(route, payrollDetail(state));
      }
      if (payrollDetailMatch && method === "DELETE") {
        state.payrollPeriodId = "period-old";
        return route.fulfill({ status: 204, body: "" });
      }
      const generateMatch = path.match(/^\/api\/payroll\/periods\/([^/]+)\/generate$/);
      if (generateMatch && method === "POST") {
        state.payrollPeriodId = generateMatch[1];
        state.payrollGenerated = true;
        state.payrollStatus = "draft";
        return json(route, payrollDetail(state));
      }
      const approveMatch = path.match(/^\/api\/payroll\/periods\/([^/]+)\/approve$/);
      if (approveMatch && method === "PATCH") {
        state.payrollPeriodId = approveMatch[1];
        state.payrollStatus = "approved";
        return json(route, payrollPeriod(state));
      }
      const paidMatch = path.match(/^\/api\/payroll\/periods\/([^/]+)\/mark-paid$/);
      if (paidMatch && method === "PATCH") {
        state.payrollPeriodId = paidMatch[1];
        state.payrollStatus = "paid";
        return json(route, payrollPeriod(state));
      }
    }

    return json(route, []);
  });

  return {
    state,
    count: (method: string, path: string) => requestCount(state, method, path),
  };
}

async function signInAsEmployee(page: Page) {
  const fixture = await installFixture(page, "employee");
  await page.goto("/login");
  await page.locator('input[autocomplete="username"]').fill("taylor");
  await page.locator('input[autocomplete="current-password"]').fill("1234");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/employee\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Taylor Santos" })).toBeVisible();
  return fixture;
}

async function signInAsAdmin(page: Page) {
  const fixture = await installFixture(page, "admin");
  await page.goto("/login");
  await page.getByRole("button", { name: "Admin" }).click();
  await page.locator('input[autocomplete="username"]').fill("admin");
  await page.locator('input[autocomplete="current-password"]').fill("1978");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Today's Overview" })).toBeVisible();
  await expect(
    page.getByText("Present", { exact: true }).locator("xpath=../..").getByText("2", { exact: true }),
  ).toBeVisible();
  return fixture;
}

async function expectToast(page: Page, text: string) {
  await expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();
}

test("admin can review attendance, scan overtime, create work, process payroll, and log out", async ({ page }) => {
  const fixture = await signInAsAdmin(page);

  await page.getByRole("link", { name: "Attendance", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Attendance Logs" })).toBeVisible();
  await expect(page.getByText("+1.50h", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Undertime Review/ }).click();
  const approveExcuse = page.getByRole("button", { name: "Approve (Waive)" });
  await expect(approveExcuse).toBeVisible();
  await approveExcuse.dblclick();
  await expectToast(page, "Excuse approved — deduction waived");
  await expect(page.getByText("No undertime records pending review. All caught up!")).toBeVisible();
  expect(fixture.count("PATCH", "/api/attendance/summaries/summary-undertime/review-undertime")).toBe(1);

  await page.getByRole("link", { name: "Overtime", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overtime Management" })).toBeVisible();
  await page.getByRole("button", { name: "Assign Overtime" }).first().click();
  await page.getByRole("combobox").selectOption(employee.id);
  await page.getByPlaceholder("e.g. Complete production backlog").fill("Admin-assigned production support");
  await page.getByRole("button", { name: "Assign Overtime" }).last().click();
  await expectToast(page, "Overtime assigned");
  await expect(page.getByText("Admin assigned: 17:00–19:00")).toBeVisible();
  expect(fixture.count("POST", "/api/admin/overtime/assign")).toBe(1);
  await page.getByRole("button", { name: "Void Overtime" }).click();
  await page.getByPlaceholder("e.g. Employee accidentally started OT and did not perform overtime work").fill("Employee accidentally started OT and did not perform overtime work");
  await page.getByRole("button", { name: "Confirm Void" }).click();
  await expectToast(page, "Overtime voided");
  expect(fixture.count("PATCH", "/api/admin/overtime/ot-assigned-1/void")).toBe(1);
  await page.getByRole("button", { name: "Record Field OT" }).click();
  await page.getByRole("combobox").selectOption(employee.id);
  await page.getByPlaceholder("e.g. Client installation at off-site location").fill("Client installation at off-site location");
  await page.getByRole("button", { name: "Record Field OT" }).last().click();
  await expectToast(page, "Field overtime recorded");
  expect(fixture.count("POST", "/api/admin/overtime/manual-record")).toBe(1);
  const scan = page.getByRole("button", { name: "Scan Unauthorized OT" });
  await scan.dblclick();
  await expectToast(page, "Scan complete — 0 unauthorized OT record(s) created");
  expect(fixture.count("POST", "/api/admin/overtime/scan-unauthorized")).toBe(1);

  await page.getByRole("link", { name: "Work Coaching", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Work Coaching" })).toBeVisible();
  await page.getByPlaceholder("Job ID (e.g. GUARIN0826)").fill("JOB-E2E");
  await page.getByPlaceholder("Client / project name").fill("E2E Client");
  await page.locator("select").filter({ has: page.locator("option", { hasText: "Assign job to employee" }) }).first().selectOption(employee.id);
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expectToast(page, "Job created");
  await expect(page.getByText("JOB-001")).toBeVisible();
  expect(fixture.count("POST", "/api/work/jobs")).toBe(1);

  await page.getByRole("link", { name: "Payroll", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payroll Periods" })).toBeVisible();
  await page.getByRole("link", { name: /View/ }).last().click();
  await expect(page.getByRole("heading", { name: "2026-08-24 → 2026-08-30" })).toBeVisible();

  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByRole("dialog", { name: "Generate payroll" })).toBeVisible();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByRole("button", { name: "Calculate 0 employees" })).toBeDisabled();
  await page.getByRole("checkbox", { name: /Taylor Santos/ }).check();
  await page.getByRole("button", { name: "Calculate 1 employee" }).click();
  await expectToast(page, "Payroll entries generated");
  await expect(page.getByText("Net Pay", { exact: true }).first()).toBeVisible();
  expect(fixture.count("POST", "/api/payroll/periods/period-e2e/generate")).toBe(1);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download payslip PNG for Taylor Santos" }).click();
  const payslipDownload = await downloadPromise;
  expect(payslipDownload.suggestedFilename()).toBe(
    "payslip-taylor-santos-2026-08-24-2026-08-30.png",
  );

  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expectToast(page, "Period approved");
  await page.getByRole("button", { name: "Mark Paid", exact: true }).click();
  await expectToast(page, "Period marked as paid");
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("admin-assigned overtime auto-starts when the employee opens the dashboard in the scheduled period", async ({ page }) => {
  const fixture = await installFixture(page, "employee");
  fixture.state.overtimeAssigned = true;
  await page.goto("/login");
  await page.locator('input[autocomplete="username"]').fill("taylor");
  await page.locator('input[autocomplete="current-password"]').fill("1234");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/employee\/dashboard$/);
  await expectToast(page, "Assigned overtime started automatically");
  expect(fixture.count("POST", "/api/overtime/auto-start-assigned")).toBe(1);
});

test("admin can correct stale overtime missing its OT time-out", async ({ page }) => {
  const fixture = await signInAsAdmin(page);
  fixture.state.staleOvertime = true;
  await page.goto("/admin/overtime");
  await expect(page.getByText("Missing OT Out", { exact: true })).toBeVisible();
  await expect(page.getByText(/passed midnight Manila time/)).toBeVisible();
  await page.getByRole("button", { name: "Enter OT Time-Out" }).click();
  await page.locator('input[type="time"]').last().fill("18:00");
  await page.getByPlaceholder("Required correction reason").fill("Verified with field supervisor");
  await page.getByRole("button", { name: "Save OT Time-Out" }).click();
  await expectToast(page, "OT time-out corrected");
  expect(fixture.count("PATCH", "/api/admin/overtime/ot-stale-1/correct-time-out")).toBe(1);
});

test("admin can create and generate a payroll period for one selected employee", async ({ page }) => {
  const fixture = await signInAsAdmin(page);
  await page.getByRole("link", { name: "Payroll", exact: true }).click();
  await page.getByRole("button", { name: "New Period" }).click();
  const dates = page.locator('input[type="date"]');
  await dates.nth(0).fill("2026-09-07");
  await dates.nth(1).fill("2026-09-12");
  await page.getByRole("radio", { name: /Selected employees/ }).check();
  await page.getByRole("checkbox", { name: /Taylor Santos/ }).check();
  await expect(page.getByText("1 employee selected.")).toBeVisible();
  await page.getByRole("button", { name: "Create & Generate Payroll" }).click();
  await expectToast(page, "Payroll period generated");
  await expect(page).toHaveURL(/\/admin\/payroll\/period-e2e$/);
  expect(fixture.count("POST", "/api/payroll/periods")).toBe(1);
  expect(fixture.count("POST", "/api/payroll/periods/period-e2e/generate")).toBe(1);
});

test("daily attendance corrections refresh only the selected employee payslip and finalized periods stay read-only", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const apiErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
    failedRequests.push(`${request.method()} ${request.url()}`);
  });
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 400) {
      apiErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  const fixture = await signInAsAdmin(page);
  fixture.state.payrollGenerated = true;
  fixture.state.payrollStatus = "draft";
  fixture.state.payrollCorrectionScenario = true;
  await page.goto("/admin/payroll/period-e2e");

  const employeeSelect = page.getByTestId("select-payslip-preview-employee");
  const preview = employeeSelect.locator("xpath=ancestor::section");
  await employeeSelect.selectOption(employee.id);
  await expect(preview.getByText("₱1,000.00", { exact: true }).last()).toBeVisible();

  await page.getByTestId("button-edit-attendance-log-1").click();
  await page.getByTestId("input-correction-daily-rate").fill("1250");
  await page.getByTestId("input-attendance-reason").fill("Approved daily rate correction");
  await page.getByTestId("button-save-attendance").click();

  await expectToast(page, "Attendance correction saved");
  await expect(preview.getByText("₱1,250.00", { exact: true }).last()).toBeVisible();
  await expect(employeeSelect).toHaveValue(employee.id);
  expect(fixture.count("PATCH", "/api/attendance/logs/log-1/correct")).toBe(1);
  expect(fixture.count("POST", "/api/payroll/periods/period-e2e/generate")).toBe(1);

  await employeeSelect.selectOption(secondEmployee.id);
  await expect(preview.getByText("₱1,000.00", { exact: true }).last()).toBeVisible();
  await expect(preview.getByText("₱1,250.00", { exact: true })).toHaveCount(0);

  fixture.state.payrollStatus = "approved";
  await page.reload();
  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Read-only", { exact: true })).toHaveCount(14);
  await expect(page.getByRole("button", { name: "Correct" })).toHaveCount(0);

  fixture.state.payrollStatus = "paid";
  await page.reload();
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Read-only", { exact: true })).toHaveCount(14);
  await expect(page.getByRole("button", { name: "Correct" })).toHaveCount(0);

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(apiErrors).toEqual([]);
});

test("admin can delete draft payroll periods but not approved or paid periods", async ({ page }) => {
  const fixture = await signInAsAdmin(page);
  fixture.state.payrollStatus = "draft";
  await page.getByRole("link", { name: "Payroll", exact: true }).click();

  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(1);
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Delete the draft payroll period");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Delete" }).click();
  await expectToast(page, "Draft payroll period deleted");
  expect(fixture.count("DELETE", "/api/payroll/periods/period-e2e")).toBe(1);
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);

  fixture.state.payrollStatus = "paid";
  await page.reload();
  await expect(page.getByRole("heading", { name: "Payroll Periods" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
});

test("employee can complete attendance, overtime, work, payroll, and log out", async ({ page }) => {
  const fixture = await signInAsEmployee(page);

  const clockIn = page.getByRole("button", { name: "Scan gate QR to clock in" });
  await clockIn.dblclick();
  await expectToast(page, "Clocked in successfully");
  await expect(page.getByText("Currently clocked in")).toBeVisible();
  expect(fixture.count("POST", "/api/attendance/clock-in")).toBe(1);

  const clockOut = page.getByRole("button", { name: "Scan gate QR to clock out" });
  await clockOut.dblclick();
  await expectToast(page, "Clocked out successfully");
  await expect(page.getByText("Day complete")).toBeVisible();
  expect(fixture.count("POST", "/api/attendance/clock-out")).toBe(1);

  await page.getByRole("button", { name: "Request Overtime" }).click();
  await page.getByPlaceholder("Describe why overtime is needed…").fill("Complete the client handoff");
  await page.getByRole("button", { name: "Submit OT Request" }).click();
  await expectToast(page, "Overtime request submitted — awaiting admin approval");
  await expect(page.getByText("Awaiting Approval")).toBeVisible();

  await page.getByRole("link", { name: "My Work Today", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Good day — here’s your brief" })).toBeVisible();
  const completeTask = page.getByRole("button", { name: "Complete task" });
  await completeTask.click();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  expect(fixture.count("PATCH", "/api/work/tasks/task-1")).toBe(1);

  await page.getByRole("link", { name: "My History", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My Attendance" })).toBeVisible();
  await expect(page.getByText("Present", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "My Payroll", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payroll History" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "₱1,000.00" }).last()).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("admin links and non-destructive controls have no broken workflow states", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
    failedRequests.push(`${request.method()} ${request.url()}`);
  });

  await signInAsAdmin(page);

  const routes = [
    { link: "Dashboard", heading: "Today's Overview", path: "/admin/dashboard" },
    { link: "Employees", heading: "Employees", path: "/admin/employees" },
    { link: "Attendance", heading: "Attendance Logs", path: "/admin/attendance" },
    { link: "Shift Rules", heading: "Shift Rules", path: "/admin/attendance-rules" },
    { link: "Overtime", heading: "Overtime Management", path: "/admin/overtime" },
    { link: "Work Coaching", heading: "Work Coaching", path: "/admin/work" },
    { link: "Payroll", heading: "Payroll Periods", path: "/admin/payroll" },
    { link: "Database", heading: "Database Inspector", path: "/admin/database" },
  ];

  for (const route of routes) {
    await page.getByRole("link", { name: route.link, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${route.path}$`));
    await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
    await expect(page.getByText("Page not found", { exact: true })).toHaveCount(0);
  }

  await page.getByRole("link", { name: "Employees", exact: true }).click();
  await page.getByRole("button", { name: "Gate QR" }).click();
  await expect(page.getByRole("heading", { name: "Office Gate QR" })).toBeVisible();
  await page.getByRole("button", { name: "Close gate QR" }).click();
  await expect(page.getByRole("heading", { name: "Office Gate QR" })).toHaveCount(0);

  await page.getByRole("button", { name: "Reset PIN" }).click();
  await expect(page.getByRole("heading", { name: "Reset PIN" })).toBeVisible();
  await page.getByRole("button", { name: "Close credentials dialog" }).click();
  await expect(page.getByRole("heading", { name: "Reset PIN" })).toHaveCount(0);

  await page.getByRole("link", { name: "Add Employee" }).click();
  await expect(page.getByRole("heading", { name: "Add Employee" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Employees" }).click();
  await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();

  await page.getByRole("link", { name: "Attendance", exact: true }).click();
  await page.getByRole("button", { name: "Manual entry" }).click();
  await expect(page.getByRole("heading", { name: "Manual attendance entry" })).toBeVisible();
  await page.getByRole("button", { name: "Close manual attendance dialog" }).click();
  await expect(page.getByRole("heading", { name: "Manual attendance entry" })).toHaveCount(0);

  await page.getByRole("link", { name: "Shift Rules", exact: true }).click();
  await page.getByRole("button", { name: "Add Rule" }).click();
  const newRuleHeading = page.getByRole("heading", { name: "New Rule" });
  await expect(newRuleHeading).toBeVisible();
  await page.getByRole("button", { name: "Close rule form" }).click();
  await expect(newRuleHeading).toHaveCount(0);
  await page.getByRole("button", { name: `Edit ${attendanceRule.name}` }).click();
  await expect(page.getByRole("heading", { name: "Edit Rule" })).toBeVisible();
  await page.getByRole("button", { name: "Close rule form" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/dashboard");
  const openNavigation = page.getByRole("button", { name: "Open navigation" });
  await openNavigation.click();
  await expect(openNavigation).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.getByRole("button", { name: "Close navigation" }).click();
  await expect(openNavigation).toHaveAttribute("aria-expanded", "false");
  await openNavigation.click();
  await page.getByRole("button", { name: "Dismiss navigation overlay" }).click();
  await expect(openNavigation).toHaveAttribute("aria-expanded", "false");
  await openNavigation.click();
  await page.getByRole("link", { name: "Employees", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/employees$/);
  await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("employee links and mobile navigation have no broken workflow states", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
    failedRequests.push(`${request.method()} ${request.url()}`);
  });

  await signInAsEmployee(page);

  const routes = [
    { link: "Clock In / Out", heading: "Taylor Santos", path: "/employee/dashboard" },
    { link: "My History", heading: "My Attendance", path: "/employee/attendance" },
    { link: "My Payroll", heading: "Payroll History", path: "/employee/payroll" },
    { link: "My Work Today", heading: "Good day — here’s your brief", path: "/employee/work" },
  ];

  for (const route of routes) {
    await page.getByRole("link", { name: route.link, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${route.path}$`));
    await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
    await expect(page.getByText("Page not found", { exact: true })).toHaveCount(0);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/employee/dashboard");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.getByRole("link", { name: "My Work Today", exact: true }).click();
  await expect(page).toHaveURL(/\/employee\/work$/);
  await expect(page.getByRole("heading", { name: "Good day — here’s your brief" })).toBeVisible();

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});