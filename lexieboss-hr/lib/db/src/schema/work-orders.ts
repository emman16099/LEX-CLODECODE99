import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const workJobsTable = pgTable("work_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Keep the legacy database column for compatibility while exposing job terminology in the app.
  jobId: varchar("order_id", { length: 100 }).notNull().unique(),
  clientName: varchar("client_name", { length: 200 }).notNull(),
  brief: text("brief").notNull().default(""),
  priority: varchar("priority", { enum: ["low", "normal", "high", "urgent"] }).notNull().default("normal"),
  status: varchar("status", { enum: ["planned", "ongoing", "late", "completed"] }).notNull().default("planned"),
  assigneeId: varchar("assignee_id").references(() => employeesTable.id),
  startDate: date("start_date", { mode: "string" }),
  // Legacy due_date values are preserved and surfaced as endDate.
  endDate: date("due_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const workJobDailyCompletionsTable = pgTable("work_job_daily_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => workJobsTable.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").notNull().references(() => employeesTable.id),
  completionDate: date("completion_date", { mode: "string" }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  jobDateUnique: uniqueIndex("work_job_daily_completions_job_date_unique").on(table.jobId, table.completionDate),
}));

// Backward-compatible aliases for code that still imports the old table name.
export const workOrdersTable = workJobsTable;
export type WorkJob = typeof workJobsTable.$inferSelect;
export type InsertWorkJob = typeof workJobsTable.$inferInsert;
export type WorkOrder = WorkJob;
export type InsertWorkOrder = InsertWorkJob;
export type WorkJobDailyCompletion = typeof workJobDailyCompletionsTable.$inferSelect;
export type InsertWorkJobDailyCompletion = typeof workJobDailyCompletionsTable.$inferInsert;