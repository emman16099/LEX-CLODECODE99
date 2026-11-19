import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { attendanceLogsTable } from "./attendance-logs";

export const attendanceCorrectionsTable = pgTable(
  "attendance_corrections",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    attendanceLogId: varchar("attendance_log_id")
      .notNull()
      .references(() => attendanceLogsTable.id, { onDelete: "cascade" }),
    field: varchar("field", { enum: ["clock_in", "clock_out", "daily_rate", "late_deduction"] }).notNull(),
    previousValue: timestamp("previous_value", { withTimezone: true }),
    newValue: timestamp("new_value", { withTimezone: true }),
    previousAmount: numeric("previous_amount", { precision: 10, scale: 2 }),
    newAmount: numeric("new_amount", { precision: 10, scale: 2 }),
    reason: varchar("reason").notNull(),
    correctedBy: varchar("corrected_by").notNull(),
    correctedByName: varchar("corrected_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("attendance_corrections_log_idx").on(table.attendanceLogId)],
);

export type AttendanceCorrection = typeof attendanceCorrectionsTable.$inferSelect;
export type InsertAttendanceCorrection = typeof attendanceCorrectionsTable.$inferInsert;