import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { attendanceRulesTable } from "./attendance-rules";

export const attendanceLogsTable = pgTable(
  "attendance_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    employeeId: varchar("employee_id")
      .notNull()
      .references(() => employeesTable.id),
    attendanceRuleId: varchar("attendance_rule_id").references(
      () => attendanceRulesTable.id,
    ),
    date: date("date").notNull(),
    clockInAt: timestamp("clock_in_at", { withTimezone: true }),
    clockOutAt: timestamp("clock_out_at", { withTimezone: true }),
    clockInPhotoUrl: varchar("clock_in_photo_url"),
    clockOutPhotoUrl: varchar("clock_out_photo_url"),
    earlyClockOutReason: varchar("early_clock_out_reason", {
      enum: ["undertime", "approved_leave", "official_errand", "approved_exception"],
    }),
    earlyClockOutNote: varchar("early_clock_out_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("attendance_logs_employee_date_unique").on(table.employeeId, table.date),
  ],
);

export type AttendanceLog = typeof attendanceLogsTable.$inferSelect;
export type InsertAttendanceLog = typeof attendanceLogsTable.$inferInsert;
