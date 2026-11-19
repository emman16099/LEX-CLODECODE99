import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

export const appUsersTable = pgTable("app_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  replitId: varchar("replit_id").notNull().unique(),
  replitUsername: varchar("replit_username"),
  role: varchar("role", { enum: ["admin", "employee"] }).notNull().default("employee"),
  employeeId: varchar("employee_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AppUser = typeof appUsersTable.$inferSelect;
export type UpsertAppUser = typeof appUsersTable.$inferInsert;
