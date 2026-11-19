import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, integer, boolean, numeric } from "drizzle-orm/pg-core";

export const attendanceRulesTable = pgTable("attendance_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  shiftStart: varchar("shift_start").notNull(),
  shiftEnd: varchar("shift_end").notNull(),
  lateCutoff: varchar("late_cutoff").notNull(),
  graceMinutes: integer("grace_minutes").notNull().default(5),
  clockOutGraceMinutes: integer("clock_out_grace_minutes").notNull().default(5),
  breakMinutes: integer("break_minutes").notNull().default(60),
  lateDeductionMode: varchar("late_deduction_mode", {
    enum: ["per_minute", "fixed_amount", "none"],
  })
    .notNull()
    .default("per_minute"),
  lateDeductionValue: numeric("late_deduction_value", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AttendanceRule = typeof attendanceRulesTable.$inferSelect;
export type InsertAttendanceRule = typeof attendanceRulesTable.$inferInsert;
