import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, date } from "drizzle-orm/pg-core";

export const payrollPeriodsTable = pgTable("payroll_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: varchar("status", { enum: ["draft", "approved", "paid"] })
    .notNull()
    .default("draft"),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type PayrollPeriod = typeof payrollPeriodsTable.$inferSelect;
export type InsertPayrollPeriod = typeof payrollPeriodsTable.$inferInsert;
