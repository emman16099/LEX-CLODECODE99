import type { employeesTable } from "@workspace/db";

type EmployeeRates = Pick<
  typeof employeesTable.$inferSelect,
  | "dailyRate"
  | "mondayRate"
  | "tuesdayRate"
  | "wednesdayRate"
  | "thursdayRate"
  | "fridayRate"
  | "saturdayRate"
  | "sundayRate"
>;

const weekdayRateKeys = [
  "sundayRate",
  "mondayRate",
  "tuesdayRate",
  "wednesdayRate",
  "thursdayRate",
  "fridayRate",
  "saturdayRate",
] as const;

export function getEmployeeRateForDate(
  employee: EmployeeRates,
  date: string,
): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return employee[weekdayRateKeys[day]] ?? employee.dailyRate;
}