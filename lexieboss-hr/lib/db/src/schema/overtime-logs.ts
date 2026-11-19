import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, date, text, numeric } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { attendanceLogsTable } from "./attendance-logs";

export const overtimeLogsTable = pgTable("overtime_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id")
    .notNull()
    .references(() => employeesTable.id),
  periodDate: date("period_date").notNull(),
  attendanceLogId: varchar("attendance_log_id").references(
    () => attendanceLogsTable.id,
  ),
  otReason: text("ot_reason"),
  assignmentSource: varchar("assignment_source", { length: 30 }),
  plannedStartTime: varchar("planned_start_time", { length: 5 }),
  plannedEndTime: varchar("planned_end_time", { length: 5 }),
  // Statuses:
  //   ot_requested              — employee submitted, awaiting admin approval
  //   ot_approved               — admin approved, employee may clock OT in
  //   ot_rejected               — admin rejected
  //   ot_in_progress            — employee has clocked OT in
  //   ot_completed_pending_review — employee clocked OT out, admin must set hours
  //   unauthorized_ot           — worked past 17:00 without prior approval
  status: varchar("status", { length: 50 }).notNull().default("ot_requested"),
  otInTime: timestamp("ot_in_time", { withTimezone: true }),
  otOutTime: timestamp("ot_out_time", { withTimezone: true }),
  approvedBy: varchar("approved_by"),
  approvedByName: varchar("approved_by_name"),
  approvalTimestamp: timestamp("approval_timestamp", { withTimezone: true }),
  approvedOvertimeHours: numeric("approved_overtime_hours", {
    precision: 5,
    scale: 2,
  }),
  adminNotes: text("admin_notes"),
  voidedBy: varchar("voided_by"),
  voidedByName: varchar("voided_by_name", { length: 255 }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type OvertimeLog = typeof overtimeLogsTable.$inferSelect;
export type InsertOvertimeLog = typeof overtimeLogsTable.$inferInsert;
