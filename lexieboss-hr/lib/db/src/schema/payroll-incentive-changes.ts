import { sql } from "drizzle-orm";
import { pgTable, varchar, numeric, integer, text, timestamp, index, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { payrollPeriodsTable } from "./payroll-periods";
import { employeesTable } from "./employees";

// Snapshots deliberately do not reference the mutable source or editor account.
export const payrollIncentiveChangesTable = pgTable("payroll_incentive_changes", {
  id: serial("id").primaryKey(),
  payrollPeriodId: varchar("payroll_period_id").notNull().references(() => payrollPeriodsTable.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").notNull().references(() => employeesTable.id),
  previousWeeklyAmount: numeric("previous_weekly_amount", { precision: 10, scale: 2 }),
  previousWeeks: integer("previous_weeks"),
  previousNote: text("previous_note"),
  newWeeklyAmount: numeric("new_weekly_amount", { precision: 10, scale: 2 }).notNull(),
  newWeeks: integer("new_weeks").notNull(),
  newNote: text("new_note").notNull(),
  editedBy: varchar("edited_by").notNull(),
  editedByName: varchar("edited_by_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
}, (table) => [
  index("payroll_incentive_changes_period_employee_idx").on(table.payrollPeriodId, table.employeeId, table.id),
]);

export const insertPayrollIncentiveChangeSchema = createInsertSchema(payrollIncentiveChangesTable).omit({ id: true, createdAt: true });
export type PayrollIncentiveChange = typeof payrollIncentiveChangesTable.$inferSelect;
export type InsertPayrollIncentiveChange = typeof payrollIncentiveChangesTable.$inferInsert;
