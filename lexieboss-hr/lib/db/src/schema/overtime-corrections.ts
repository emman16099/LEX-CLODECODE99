import { sql } from "drizzle-orm";
import { numeric, pgTable, varchar, timestamp, text } from "drizzle-orm/pg-core";
import { overtimeLogsTable } from "./overtime-logs";

export const overtimeCorrectionsTable = pgTable("overtime_corrections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  overtimeLogId: varchar("overtime_log_id").notNull().references(() => overtimeLogsTable.id),
  action: varchar("action", { length: 50 }).notNull(),
  originalOtInTime: timestamp("original_ot_in_time", { withTimezone: true }),
  originalOtOutTime: timestamp("original_ot_out_time", { withTimezone: true }),
  correctedOtInTime: timestamp("corrected_ot_in_time", { withTimezone: true }),
  correctedOtOutTime: timestamp("corrected_ot_out_time", { withTimezone: true }),
  originalApprovedHours: numeric("original_approved_hours", { precision: 5, scale: 2 }),
  correctedApprovedHours: numeric("corrected_approved_hours", { precision: 5, scale: 2 }),
  reason: text("reason").notNull(),
  adminId: varchar("admin_id").notNull(),
  adminName: varchar("admin_name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});