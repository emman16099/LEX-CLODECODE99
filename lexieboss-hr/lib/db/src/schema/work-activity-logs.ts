import { sql } from "drizzle-orm";
import { pgTable, varchar, text, date, timestamp, index } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const workActivityLogsTable = pgTable("work_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  activityDate: date("activity_date", { mode: "string" }).notNull(),
  kind: varchar("kind", { enum: ["event", "accomplishment"] }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  details: text("details").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  employeeDateIndex: index("work_activity_logs_employee_date_idx").on(table.employeeId, table.activityDate),
  dateIndex: index("work_activity_logs_date_idx").on(table.activityDate),
}));

export type WorkActivityLog = typeof workActivityLogsTable.$inferSelect;
export type InsertWorkActivityLog = typeof workActivityLogsTable.$inferInsert;