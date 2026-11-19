import { useState } from "react";
import { useGetMyAttendanceHistory, useGetMyAttendanceStats } from "@workspace/api-client-react";
import { format, subDays } from "date-fns";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  present: { label: "Present", cls: "status-present" },
  late: { label: "Late", cls: "status-late" },
  absent: { label: "Absent", cls: "status-absent" },
  missing_logout: { label: "No Clock-Out", cls: "status-missing_logout" },
};

const UT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_review: { label: "Excuse Pending Review", color: "bg-orange-100 text-orange-700" },
  approved: { label: "Excuse Approved", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Excuse Rejected", color: "bg-red-100 text-red-700" },
};

const REASON_LABELS: Record<string, string> = {
  undertime: "Undertime",
  approved_leave: "Approved Leave",
  official_errand: "Official Errand",
  approved_exception: "Approved Exception",
};

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return format(new Date(iso), "h:mm a");
}

export default function EmployeeHistory() {
  const defaultFrom = format(subDays(new Date(), 29), "yyyy-MM-dd");
  const defaultTo = format(new Date(), "yyyy-MM-dd");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const { data: history, isLoading } = useGetMyAttendanceHistory({ from, to });
  const { data: stats } = useGetMyAttendanceStats({ from, to });

  const totalDays = history?.length ?? 0;
  const presentCount = stats?.presentCount ?? 0;
  const lateCount = stats?.lateCount ?? 0;
  const totalHours = parseFloat(stats?.totalHours ?? "0");
  const totalLateDeductions = parseFloat(stats?.totalLateDeductions ?? "0");
  const totalUndertimeDeductions = parseFloat(stats?.totalUndertimeDeductions ?? "0");
  const totalDeductions = totalLateDeductions + totalUndertimeDeductions;
  const totalLateMinutes = stats?.totalLateMinutes ?? 0;
  const undertimeCount = stats?.undertimeCount ?? 0;
  const totalUndertimeMinutes = stats?.totalUndertimeMinutes ?? 0;
  const totalUndertimeHours = totalUndertimeMinutes / 60;

  return (
    <div className="page-container max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">My Attendance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your attendance history</p>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span>to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Summary cards */}
      {!isLoading && totalDays > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Days Present", value: presentCount },
            { label: "Days Late", value: lateCount },
            { label: "Undertime Days", value: undertimeCount },
            { label: "Undertime Hours", value: totalUndertimeHours > 0 ? `${totalUndertimeHours.toFixed(1)}h` : "—" },
            { label: "Late Minutes", value: `${totalLateMinutes}m` },
            { label: "Total Hours", value: `${totalHours.toFixed(1)}h` },
            {
              label: "Deductions",
              value: totalDeductions > 0 ? `−₱${totalDeductions.toFixed(2)}` : "₱0.00",
              valueClass: totalDeductions > 0 ? "text-red-600" : undefined,
            },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-card-border rounded-lg p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{s.label}</div>
              <div className={`text-xl font-bold ${s.valueClass ?? "text-foreground"}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="table-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border bg-muted/30">
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Date</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Clock In</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Clock Out</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Hours</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Undertime</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, j) => (
                  <td key={j} className="px-5 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : !history?.length ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground text-sm">
                  No attendance records for this period.
                </td>
              </tr>
            ) : history.map((item, i) => {
              const statusInfo = STATUS_LABELS[item.summary?.status ?? ""] ?? null;
              const undertimeMinutes = item.summary?.undertimeMinutes ?? 0;
              const undertimeDeduction = parseFloat(item.summary?.undertimeDeductionAmount ?? "0");
              const utStatus = item.summary?.undertimeStatus ?? null;
              const utStatusInfo = utStatus ? UT_STATUS_LABELS[utStatus] : null;
              return (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">
                    {item.log.date ? format(new Date(item.log.date + "T00:00:00"), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-5 py-3 text-foreground">{formatTime(item.log.clockInAt)}</td>
                  <td className="px-5 py-3">
                    <div className="text-foreground">{formatTime(item.log.clockOutAt)}</div>
                    {item.log.earlyClockOutReason && (
                      <div className="text-xs text-orange-600 mt-0.5">{REASON_LABELS[item.log.earlyClockOutReason] ?? item.log.earlyClockOutReason}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">
                    {item.summary?.regularHours ? `${item.summary.regularHours}h` : "—"}
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    {undertimeMinutes > 0 ? (
                      <div>
                        <div className="text-sm font-medium text-orange-700">{undertimeMinutes}m</div>
                        {undertimeDeduction > 0 && (
                          <div className="text-xs text-red-600">−₱{undertimeDeduction.toFixed(2)}</div>
                        )}
                        {utStatusInfo && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${utStatusInfo.color}`}>
                            {utStatusInfo.label}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {statusInfo ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.cls}`}>
                        {statusInfo.label}
                        {item.summary?.isLate && item.summary.lateMinutes > 0 ? ` +${item.summary.lateMinutes}m` : ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
