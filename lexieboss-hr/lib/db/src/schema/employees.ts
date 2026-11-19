import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, date, numeric } from "drizzle-orm/pg-core";

export const employeesTable = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeCode: varchar("employee_code").notNull().unique(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  mobileNumber: varchar("mobile_number").notNull(),
  address: varchar("address", { length: 1000 }).notNull(),
  hireDate: date("hire_date").notNull(),
  employmentStatus: varchar("employment_status", {
    enum: ["active", "inactive", "terminated"],
  })
    .notNull()
    .default("active"),
  dailyRate: numeric("daily_rate", { precision: 10, scale: 2 }).notNull(),
  mondayRate: numeric("monday_rate", { precision: 10, scale: 2 }),
  tuesdayRate: numeric("tuesday_rate", { precision: 10, scale: 2 }),
  wednesdayRate: numeric("wednesday_rate", { precision: 10, scale: 2 }),
  thursdayRate: numeric("thursday_rate", { precision: 10, scale: 2 }),
  fridayRate: numeric("friday_rate", { precision: 10, scale: 2 }),
  saturdayRate: numeric("saturday_rate", { precision: 10, scale: 2 }),
  sundayRate: numeric("sunday_rate", { precision: 10, scale: 2 }),
  overtimeRate: numeric("overtime_rate", { precision: 10, scale: 2 }),
  sssNumber: varchar("sss_number").notNull(),
  philhealthNumber: varchar("philhealth_number").notNull(),
  pagibigNumber: varchar("pagibig_number").notNull(),
  portalUsername: varchar("portal_username", { length: 100 }).unique(),
  portalPasswordHash: varchar("portal_password_hash", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Employee = typeof employeesTable.$inferSelect;
export type InsertEmployee = typeof employeesTable.$inferInsert;
