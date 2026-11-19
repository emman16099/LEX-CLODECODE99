import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, date, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const employeeDailyTasksTable = pgTable("employee_daily_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  taskDate: date("task_date", { mode: "string" }).notNull(),
  repeatDaily: boolean("repeat_daily").notNull().default(false),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull().default(""),
  completed: boolean("completed").notNull().default(false),
  completedOn: date("completed_on", { mode: "string" }),
  employeeNote: text("employee_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const employeeDailyTaskCompletionsTable = pgTable("employee_daily_task_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => employeeDailyTasksTable.id, { onDelete: "cascade" }),
  completionDate: date("completion_date", { mode: "string" }).notNull(),
  completed: boolean("completed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  taskDateUnique: uniqueIndex("employee_daily_task_completions_task_date_unique").on(table.taskId, table.completionDate),
}));

export type EmployeeDailyTaskCompletion = typeof employeeDailyTaskCompletionsTable.$inferSelect;
export type InsertEmployeeDailyTaskCompletion = typeof employeeDailyTaskCompletionsTable.$inferInsert;

export type EmployeeDailyTask = typeof employeeDailyTasksTable.$inferSelect;
export type InsertEmployeeDailyTask = typeof employeeDailyTasksTable.$inferInsert;