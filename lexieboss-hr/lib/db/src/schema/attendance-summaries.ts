import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, date, integer, boolean, numeric } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { attendanceLogsTable } from "./attendance-logs";

export const attendanceSummariesTable = pgTable("attendance_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id")
    .notNull()
    .references(() => employeesTable.id),
  attendanceLogId: varchar("attendance_log_id").references(
    () => attendanceLogsTable.id,
  ),
  date: date("date").notNull(),
  status: varchar("status", {
    enum: ["present", "late", "absent", "missing_logout"],
  }).notNull(),
  isLate: boolean("is_late").notNull().default(false),
  lateMinutes: integer("late_minutes").notNull().default(0),
  regularHours: numeric("regular_hours", { precision: 5, scale: 2 }).notNull().default("0"),
  dailyRateOverride: numeric("daily_rate_override", { precision: 10, scale: 2 }),
  lateDeductionAmount: numeric("late_deduction_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  lateDeductionOverride: numeric("late_deduction_override", { precision: 10, scale: 2 }),
  undertimeMinutes: integer("undertime_minutes").notNull().default(0),
  undertimeDeductionAmount: numeric("undertime_deduction_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  undertimeStatus: varchar("undertime_status", {
    enum: ["pending_review", "approved", "rejected"],
  }),
  undertimeReviewNote: varchar("undertime_review_note"),
  undertimeReviewedBy: varchar("undertime_reviewed_by"),
  undertimeReviewedAt: timestamp("undertime_reviewed_at", { withTimezone: true }),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AttendanceSummary = typeof attendanceSummariesTable.$inferSelect;
export type InsertAttendanceSummary = typeof attendanceSummariesTable.$inferInsert;
