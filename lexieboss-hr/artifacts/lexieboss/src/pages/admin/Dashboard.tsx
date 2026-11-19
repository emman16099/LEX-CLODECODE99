import { useState } from "react";
import { useGetTodayAttendanceSummary, useListAttendanceStats, useListAdminOvertime, useListUndertimePending } from "@workspace/api-client-react";
import { format, startOfWeek, startOfMonth, subDays } from "date-fns";
import { Users, Clock, UserX, AlertCircle, TrendingUp, Timer, LogOut } from "lucide-react";
import { Link } from "wouter";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={`p-2 rounded-md ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-3xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return format(new Date(iso), "h:mm a");
}

type Period = "week" | "month" | "custom";

function usePeriodDates(period: Period, customFrom: string, customTo: string) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  if (period === "week") {
    return {
      from: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      to: todayStr,
    };
  }
  if (period === "month") {
    return {
      from: format(startOfMonth(today), "yyyy-MM-dd"),
      to: todayStr,
    };
  }
  return { from: customFrom, to: customTo };
}

export default function AdminDashboard() {
  const { data, isLoading } = useGetTodayAttendanceSummary();
  const today = format(new Date(), "EEEE, MMMM d, yyyy");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [period, setPeriod] = useState<Period>("week");
  const [customFrom, setCustomFrom] = useState(format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(todayStr);

  const { from, to } = usePeriodDates(period, customFrom, customTo);

  const { data: stats, isLoading: statsLoading } = useListAttendanceStats({ from, to });

  const { data: otRequested } = useListAdminOvertime({ status: "ot_requested" });
  const { data: otPendingReview } = useListAdminOvertime({ status: "ot_completed_pending_review" });
  const { data: otUnauthorized } = useListAdminOvertime({ status: "unauthorized_ot" });
  const { data: undertimePending } = useListUndertimePending();

  const pendingOTCount = (otRequested?.length ?? 0) + (otPendingReview?.length ?? 0) + (otUnauthorized?.length ?? 0);
  const pendingUTCount = undertimePending?.length ?? 0;

  const periodLabel =
    period === "week" ? "This Week" :
    period === "month" ? "This Month" :
    `${from} – ${to}`;

  return (
    <div className="page-container">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Today's Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-lg p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Active" value={data.totalEmployees} icon={Users} color="bg-primary/10 text-primary" />
          <StatCard
            label="Present"
            value={data.presentCount + data.lateCount + data.missingLogoutCount}
            icon={Clock}
            color="bg-emerald-100 text-emerald-700"
          />
          <StatCard label="Late" value={data.lateCount} icon={AlertCircle} color="bg-amber-100 text-amber-700" />
          <StatCard label="Absent" value={data.absentCount} icon={UserX} color="bg-red-100 text-red-700" />
        </div>
      ) : null}

      {/* Overtime pending widget */}
      {pendingOTCount > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 sm:px-5 py-4 flex items-start sm:items-center gap-3 sm:gap-4">
          <div className="p-2 rounded-md bg-amber-100">
            <Timer className="w-4 h-4 text-amber-700" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-amber-800">
              {pendingOTCount} overtime item{pendingOTCount !== 1 ? "s" : ""} need attention
            </div>
            <div className="text-xs text-amber-700 mt-0.5 space-x-3">
              {(otRequested?.length ?? 0) > 0 && <span>{otRequested!.length} pending approval</span>}
              {(otPendingReview?.length ?? 0) > 0 && <span>{otPendingReview!.length} pending review</span>}
              {(otUnauthorized?.length ?? 0) > 0 && <span>{otUnauthorized!.length} unauthorized</span>}
            </div>
          </div>
          <Link href="/admin/overtime" className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 whitespace-nowrap">
            Manage Overtime →
          </Link>
        </div>
      )}

      {/* Undertime pending widget */}
      {pendingUTCount > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg overflow-hidden">
           <div className="px-4 sm:px-5 py-4 flex items-start sm:items-center gap-3 sm:gap-4">
            <div className="p-2 rounded-md bg-orange-100">
              <LogOut className="w-4 h-4 text-orange-700" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-orange-800">
                {pendingUTCount} undertime record{pendingUTCount !== 1 ? "s" : ""} pending review
              </div>
              <div className="text-xs text-orange-700 mt-0.5">
                Review early clock-outs and approve or reject excuse requests
              </div>
            </div>
            <Link href="/admin/attendance" className="text-xs font-semibold text-orange-700 hover:text-orange-900 underline underline-offset-2 whitespace-nowrap">
              Review All →
            </Link>
          </div>
          <div className="border-t border-orange-200 divide-y divide-orange-100">
            {undertimePending!.slice(0, 5).map((item) => {
              const emp = item.employee;
              const summary = item.summary;
              const log = item.log;
              const reasonMap: Record<string, string> = {
                approved_leave: "Approved Leave",
                official_errand: "Official Errand",
                approved_exception: "Approved Exception",
              };
              const reason = log.earlyClockOutReason ? reasonMap[log.earlyClockOutReason] ?? log.earlyClockOutReason : "—";
              return (
                <Link key={summary?.id ?? log.id} href="/admin/attendance" className="flex items-center justify-between px-5 py-3 hover:bg-orange-100/60 transition-colors cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-orange-900">
                        {emp ? `${emp.firstName} ${emp.lastName}` : log.employeeId}
                      </div>
                      <div className="text-xs text-orange-700">
                        {log.date} &bull; {reason}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-orange-800">{summary?.undertimeMinutes ?? 0}m early</div>
                      {parseFloat(summary?.undertimeDeductionAmount ?? "0") > 0 && (
                        <div className="text-xs text-red-600">−₱{parseFloat(summary!.undertimeDeductionAmount!).toFixed(2)}</div>
                      )}
                    </div>
                </Link>
              );
            })}
            {pendingUTCount > 5 && (
              <div className="px-5 py-2 text-xs text-orange-700 text-center">
                +{pendingUTCount - 5} more —{" "}
                <Link href="/admin/attendance" className="underline font-semibold">view all</Link>
              </div>
            )}
          </div>
        </div>
      )}

      {(pendingOTCount > 0 || pendingUTCount > 0) ? <div className="mb-4" /> : <div className="mb-8" />}

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 mb-8">
        {/* Late employees */}
        <div className="bg-card border border-card-border rounded-lg">
          <div className="px-5 py-4 border-b border-card-border flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <h2 className="font-semibold text-sm text-foreground">Late Today</h2>
            <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {data?.lateCount ?? 0}
            </span>
          </div>
          <div className="divide-y divide-border">
            {!data?.lateEmployees?.length ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">No late employees today.</div>
            ) : (
              data.lateEmployees.map((item, i) => item && (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {item.employee?.firstName} {item.employee?.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.employee?.employeeCode} &bull; Clocked in {formatTime(item.log.clockInAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium block">
                      +{item.summary?.lateMinutes ?? 0} min
                    </span>
                    {item.summary?.lateDeductionAmount && parseFloat(item.summary.lateDeductionAmount) > 0 && (
                      <span className="text-xs text-red-600 font-medium mt-0.5 block">
                        −₱{parseFloat(item.summary.lateDeductionAmount).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Missing logout */}
        <div className="bg-card border border-card-border rounded-lg">
          <div className="px-5 py-4 border-b border-card-border flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-600" />
            <h2 className="font-semibold text-sm text-foreground">Missing Clock-Out</h2>
            <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
              {data?.missingLogoutCount ?? 0}
            </span>
          </div>
          <div className="divide-y divide-border">
            {!data?.missingLogoutEmployees?.length ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">No missing clock-outs.</div>
            ) : (
              data.missingLogoutEmployees.map((item, i) => item && (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {item.employee?.firstName} {item.employee?.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.employee?.employeeCode} &bull; In at {formatTime(item.log.clockInAt)}
                    </div>
                  </div>
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium">No out</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Period Stats */}
      <div className="bg-card border border-card-border rounded-lg">
        <div className="px-5 py-4 border-b border-card-border flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">Attendance Tallies</h2>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {(["week", "month", "custom"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-input"
                }`}
              >
                {p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom"}
              </button>
            ))}
            {period === "custom" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-2 py-1 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                <span>–</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                  className="px-2 py-1 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            )}
            {period !== "custom" && (
              <span className="text-xs text-muted-foreground hidden sm:block">{from} – {to}</span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-muted/30">
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Employee</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Present</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Late</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Late Mins</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Undertime</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Deductions</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {statsLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-5 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : !stats?.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground text-sm">
                    No employee data for {periodLabel}.
                  </td>
                </tr>
              ) : stats.map((row) => {
                const totalDeductions = parseFloat(row.totalLateDeductions) + parseFloat(row.totalUndertimeDeductions);
                return (
                  <tr key={row.employeeId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-foreground">{row.employee?.firstName} {row.employee?.lastName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{row.employee?.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-foreground">{row.presentCount}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.lateCount > 0 ? (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{row.lateCount}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground hidden md:table-cell">
                      {row.totalLateMinutes > 0 ? `${row.totalLateMinutes}m` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      {row.undertimeCount > 0 ? (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                          {row.undertimeCount}× ({row.totalUndertimeMinutes}m)
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {totalDeductions > 0 ? (
                        <span className="text-sm font-semibold text-red-600">−₱{totalDeductions.toFixed(2)}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground hidden sm:table-cell">
                      {parseFloat(row.totalHours) > 0 ? `${parseFloat(row.totalHours).toFixed(1)}h` : "—"}
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
