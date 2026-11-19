import { sql } from "drizzle-orm";
import { pgTable, varchar, numeric, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { payrollPeriodsTable } from "./payroll-periods";
import { employeesTable } from "./employees";

// Separate from generated entries so attendance corrections cannot erase incentives.
export const payrollIncentivesTable = pgTable("payroll_incentives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  payrollPeriodId: varchar("payroll_period_id").notNull().references(() => payrollPeriodsTable.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").notNull().references(() => employeesTable.id),
  weeklyAmount: numeric("weekly_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  weeks: integer("weeks").notNull().default(1),
  note: text("note").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("payroll_incentives_period_employee_unique").on(table.payrollPeriodId, table.employeeId),
]);

export const insertPayrollIncentiveSchema = createInsertSchema(payrollIncentivesTable).omit({ id: true, updatedAt: true });
export type PayrollIncentive = typeof payrollIncentivesTable.$inferSelect;
export type InsertPayrollIncentive = typeof payrollIncentivesTable.$inferInsert;
