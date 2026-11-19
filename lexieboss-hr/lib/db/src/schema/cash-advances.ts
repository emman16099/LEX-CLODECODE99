import { sql } from "drizzle-orm";
import { date, numeric, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { payrollPeriodsTable } from "./payroll-periods";

export const cashAdvancesTable = pgTable("cash_advances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id")
    .notNull()
    .references(() => employeesTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  advanceDate: date("advance_date", { mode: "string" }).notNull(),
  deductionDate: date("deduction_date", { mode: "string" }),
  note: varchar("note", { length: 500 }),
  deductedPayrollPeriodId: varchar("deducted_payroll_period_id").references(
    () => payrollPeriodsTable.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CashAdvance = typeof cashAdvancesTable.$inferSelect;
export type InsertCashAdvance = typeof cashAdvancesTable.$inferInsert;