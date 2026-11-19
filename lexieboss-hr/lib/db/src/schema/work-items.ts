import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, date } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { workJobsTable } from "./work-orders";

export const workItemsTable = pgTable("work_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Keep the legacy database column for compatibility while exposing job terminology in the app.
  jobId: varchar("order_id").notNull().references(() => workJobsTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull().default(""),
  assigneeId: varchar("assignee_id").notNull().references(() => employeesTable.id),
  status: varchar("status", { enum: ["not_started", "in_progress", "blocked", "done"] }).notNull().default("not_started"),
  dueDate: date("due_date", { mode: "string" }),
  employeeNote: text("employee_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type WorkItem = typeof workItemsTable.$inferSelect;
export type InsertWorkItem = typeof workItemsTable.$inferInsert;