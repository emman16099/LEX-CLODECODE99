import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { payrollPeriodsTable } from "./payroll-periods";
import { employeesTable } from "./employees";

export const payrollEntriesTable = pgTable("payroll_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  payrollPeriodId: varchar("payroll_period_id")
    .notNull()
    .references(() => payrollPeriodsTable.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id")
    .notNull()
    .references(() => employeesTable.id),
  dailyRateSnapshot: numeric("daily_rate_snapshot", { precision: 10, scale: 2 }).notNull(),
  daysPresent: integer("days_present").notNull().default(0),
  daysAbsent: integer("days_absent").notNull().default(0),
  lateCount: integer("late_count").notNull().default(0),
  totalLateMinutes: integer("total_late_minutes").notNull().default(0),
  undertimeCount: integer("undertime_count").notNull().default(0),
  totalUndertimeMinutes: integer("total_undertime_minutes").notNull().default(0),
  regularPay: numeric("regular_pay", { precision: 10, scale: 2 }).notNull().default("0"),
  lateDeductionTotal: numeric("late_deduction_total", { precision: 10, scale: 2 }).notNull().default("0"),
  undertimeDeductionTotal: numeric("undertime_deduction_total", { precision: 10, scale: 2 }).notNull().default("0"),
  cashAdvanceDeduction: numeric("cash_advance_deduction", { precision: 10, scale: 2 }).notNull().default("0"),
  overtimePay: numeric("overtime_pay", { precision: 10, scale: 2 }).notNull().default("0"),
  incentivePay: numeric("incentive_pay", { precision: 10, scale: 2 }).notNull().default("0"),
  grossPay: numeric("gross_pay", { precision: 10, scale: 2 }).notNull().default("0"),
  netPay: numeric("net_pay", { precision: 10, scale: 2 }).notNull().default("0"),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type PayrollEntry = typeof payrollEntriesTable.$inferSelect;
export type InsertPayrollEntry = typeof payrollEntriesTable.$inferInsert;
