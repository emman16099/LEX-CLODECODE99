import { pgTable, varchar, date, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const specialWorkingDaysTable = pgTable("special_working_days", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  date: date("date").notNull().unique(),
  reason: varchar("reason", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
