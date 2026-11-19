import { useRef, useState } from "react";
import {
  useListAttendanceLogs,
  useListPayrollPeriods,
  useListEmployees,
  useListAttendanceRules,
  useListUndertimePending,
  useReviewUndertime,
  useCorrectAttendance,
  useRecordManualAttendance,
  getListAttendanceLogsQueryKey,
  getListUndertimePendingQueryKey,
  getGetTodayAttendanceSummaryQueryKey,
  getListPayrollPeriodsQueryKey,
  type ListAttendanceLogsStatus,
  type ListEmployeesStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Filter, CheckCircle, XCircle, LogOut, Edit3, History, X, Clock3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  present: { label: "Present", cls: "status-present" },
  late: { label: "Late", cls: "status-late" },
  absent: { label: "Absent", cls: "status-absent" },
  missing_logout: { label: "No Clock-Out", cls: "status-missing_logout" },
};

const UT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_review: { label: "Pending Review", color: "bg-orange-100 text-orange-700" },
  approved: { label: "Excuse Approved — No Deduction", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Excuse Rejected — Deducted", color: "bg-red-100 text-red-700" },
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

function toDateTimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function manilaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}-${parts.find((part) => part.type === "day")!.value}`;
}

type ViewMode = "logs" | "undertime";
type ManualAction = "clock_in" | "clock_out";

export default function AdminAttendanceLogs() {
  const today = manilaToday();
  const [payrollReviewScope, setPayrollReviewScope] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") !== "undertime" || !params.get("employeeIds") || !params.get("from") || !params.get("to")) return null;
    return { from: params.get("from")!, to: params.get("to")!, employeeIds: params.get("employeeIds")!.split(",") };
  });
  const [from, setFrom] = useState(() => payrollReviewScope?.from ?? today);
  const [to, setTo] = useState(() => payrollReviewScope?.to ?? today);
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => payrollReviewScope ? "undertime" : "logs");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [correctionItem, setCorrectionItem] = useState<NonNullable<typeof logs>[number] | null>(null);
  const [correctionClockIn, setCorrectionClockIn] = useState("");
  const [correctionClockOut, setCorrectionClockOut] = useState("");
  const [correctionOvertimeHours, setCorrectionOvertimeHours] = useState("");
  const [correctionDailyRate, setCorrectionDailyRate] = useState("");
  const [correctionLateDeduction, setCorrectionLateDeduction] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualEmployeeId, setManualEmployeeId] = useState("");
  const [manualDate, setManualDate] = useState(today);
  const [manualAction, setManualAction] = useState<ManualAction>("clock_in");
  const [manualTime, setManualTime] = useState("08:00");
  const [manualRuleId, setManualRuleId] = useState("");
  const [manualReason, setManualReason] = useState("");
  const reviewInFlightRef = useRef<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: logs, isLoading } = useListAttendanceLogs({
    from: from || undefined,
    to: to || undefined,
    employeeId: employeeId || undefined,
    status: (status || undefined) as ListAttendanceLogsStatus | undefined,
  });

  const { data: employees } = useListEmployees({ status: "active" as ListEmployeesStatus });
  const { data: payrollPeriods } = useListPayrollPeriods();
  const { data: attendanceRules } = useListAttendanceRules();
  const { data: undertimePending, isLoading: utLoading } = useListUndertimePending();
  const visibleUndertimePending = payrollReviewScope
    ? undertimePending?.filter((item) =>
        item.summary &&
        payrollReviewScope.employeeIds.includes(item.summary.employeeId) &&
        item.summary.date >= payrollReviewScope.from &&
        item.summary.date <= payrollReviewScope.to,
      )
    : undertimePending;

  const reviewMutation = useReviewUndertime();
  const correctionMutation = useCorrectAttendance();
  const manualMutation = useRecordManualAttendance();
  const activeRules = attendanceRules?.filter((rule) => rule.isActive) ?? [];

  const isFiltered = from !== today || to !== today || !!employeeId || !!status;
  const refreshAttendanceViews = () => {
    queryClient.invalidateQueries({ queryKey: getListAttendanceLogsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListUndertimePendingQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListPayrollPeriodsQueryKey() });
  };

  const handleReview = async (summaryId: string, decision: "approved" | "rejected") => {
    if (reviewInFlightRef.current === summaryId) return;
    reviewInFlightRef.current = summaryId;
    const reviewNote = reviewNotes[summaryId] || undefined;
    try {
      await reviewMutation.mutateAsync({ id: summaryId, data: { decision, reviewNote } });
      toast({
        title: decision === "approved" ? "Excuse approved — deduction waived" : "Excuse rejected — deduction kept",
      });
      setReviewNotes((prev) => { const next = { ...prev }; delete next[summaryId]; return next; });
      refreshAttendanceViews();
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      toast({ title: "Review failed", description: e?.data?.error ?? e?.message ?? "Error", variant: "destructive" });
    } finally {
      if (reviewInFlightRef.current === summaryId) reviewInFlightRef.current = null;
    }
  };

  const openCorrection = (item: NonNullable<typeof logs>[number]) => {
    setCorrectionItem(item);
    setCorrectionClockIn(toDateTimeLocal(item.log.clockInAt));
    setCorrectionClockOut(toDateTimeLocal(item.log.clockOutAt));
    setCorrectionOvertimeHours(item.overtimeHours ? parseFloat(item.overtimeHours).toFixed(2) : "");
    setCorrectionDailyRate(item.applicableDailyRate ? parseFloat(item.applicableDailyRate).toFixed(2) : "");
    setCorrectionLateDeduction(parseFloat(item.summary?.lateDeductionAmount ?? "0").toFixed(2));
    setCorrectionReason("");
  };

  const closeCorrection = () => {
    setCorrectionItem(null);
    setCorrectionClockIn("");
    setCorrectionClockOut("");
    setCorrectionOvertimeHours("");
    setCorrectionDailyRate("");
    setCorrectionLateDeduction("");
    setCorrectionReason("");
  };

  const handleCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionItem) return;

    const originalClockIn = toDateTimeLocal(correctionItem.log.clockInAt);
    const originalClockOut = toDateTimeLocal(correctionItem.log.clockOutAt);
    const originalOvertimeHours = correctionItem.overtimeHours ? parseFloat(correctionItem.overtimeHours).toFixed(2) : "";
    const originalDailyRate = correctionItem.applicableDailyRate ? parseFloat(correctionItem.applicableDailyRate).toFixed(2) : "";
    const originalLateDeduction = parseFloat(correctionItem.summary?.lateDeductionAmount ?? "0").toFixed(2);
    const data: { reason: string; clockInAt?: string | null; clockOutAt?: string | null; overtimeHours?: number; dailyRate?: number; lateDeduction?: number } = {
      reason: correctionReason.trim(),
    };
    if (correctionClockIn !== originalClockIn) data.clockInAt = toIsoDateTime(correctionClockIn);
    if (correctionClockOut !== originalClockOut) data.clockOutAt = toIsoDateTime(correctionClockOut);
    if (correctionOvertimeHours !== originalOvertimeHours && correctionOvertimeHours !== "") {
      data.overtimeHours = Number(correctionOvertimeHours);
    }
    if (correctionDailyRate !== originalDailyRate && correctionDailyRate !== "") data.dailyRate = Number(correctionDailyRate);
    if (correctionLateDeduction !== originalLateDeduction && correctionLateDeduction !== "") data.lateDeduction = Number(correctionLateDeduction);

    if (!data.reason) {
      toast({ title: "Reason required", description: "Explain why this fieldwork correction is needed.", variant: "destructive" });
      return;
    }
    if (data.clockInAt === undefined && data.clockOutAt === undefined && data.overtimeHours === undefined && data.dailyRate === undefined && data.lateDeduction === undefined) {
      toast({ title: "No changes made", description: "Change a timestamp, daily rate, late deduction, or approved overtime hours before saving.", variant: "destructive" });
      return;
    }
    if (payrollPeriods?.some((period) => period.status === "approved" && correctionItem.log.date >= period.startDate && correctionItem.log.date <= period.endDate)
      && !window.confirm("This correction will withdraw approval for the affected payroll and return it to Draft. Regenerate and approve the payroll again afterward. Continue?")) return;

    try {
      await correctionMutation.mutateAsync({ id: correctionItem.log.id, data });
      toast({ title: "Attendance corrected", description: "The change was audited. If this date was in an approved payroll, it is now a draft and must be generated and approved again." });
      closeCorrection();
      refreshAttendanceViews();
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      toast({ title: "Correction failed", description: e?.data?.error ?? e?.message ?? "Error", variant: "destructive" });
    }
  };

  const openManual = () => {
    setManualOpen(true);
    setManualEmployeeId("");
    setManualDate(from || today);
    setManualAction("clock_in");
    setManualTime("08:00");
    setManualRuleId(activeRules[0]?.id ?? "");
    setManualReason("");
  };

  const closeManual = () => {
    setManualOpen(false);
    setManualEmployeeId("");
    setManualDate(today);
    setManualAction("clock_in");
    setManualTime("08:00");
    setManualRuleId("");
    setManualReason("");
  };

  const handleManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const reason = manualReason.trim();
    if (!manualEmployeeId || !manualDate || !manualTime || !reason) {
      toast({
        title: "Complete all required fields",
        description: "Select an employee, date, action, time, and reason.",
        variant: "destructive",
      });
      return;
    }
    if (payrollPeriods?.some((period) => period.status === "approved" && manualDate >= period.startDate && manualDate <= period.endDate)
      && !window.confirm("This attendance entry will withdraw approval for the affected payroll and return it to Draft. Regenerate and approve the payroll again afterward. Continue?")) return;

    try {
      await manualMutation.mutateAsync({
        data: {
          employeeId: manualEmployeeId,
          date: manualDate,
          action: manualAction,
          time: manualTime,
          ...(manualAction === "clock_in" ? { attendanceRuleId: manualRuleId || null } : {}),
          reason,
        },
      });
      toast({
        title: manualAction === "clock_in" ? "Manual clock-in recorded" : "Manual clock-out recorded",
        description: "The attendance summary was recalculated and the entry was added to the audit history.",
      });
      closeManual();
      refreshAttendanceViews();
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      toast({ title: "Manual attendance failed", description: e?.data?.error ?? e?.message ?? "Error", variant: "destructive" });
    }
  };

  return (
    <div className="page-container">
      <div className="mb-6 flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Attendance Logs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {viewMode === "logs"
              ? `${logs?.length ?? 0} record${logs?.length !== 1 ? "s" : ""}`
              : `${visibleUndertimePending?.length ?? 0} undertime record${visibleUndertimePending?.length !== 1 ? "s" : ""} pending review${payrollReviewScope ? " for this payroll" : ""}`}
          </p>
        </div>
        <div className="flex w-full sm:w-auto gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={openManual}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Clock3 className="w-3.5 h-3.5" />
            Manual entry
          </button>
          <button
            type="button"
            onClick={() => setViewMode("logs")}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewMode === "logs"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-input"
            }`}
          >
            All Logs
          </button>
          <button
            type="button"
            onClick={() => setViewMode("undertime")}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewMode === "undertime"
                ? "bg-orange-600 text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-input"
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            Undertime Review
            {(visibleUndertimePending?.length ?? 0) > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold ${viewMode === "undertime" ? "bg-white text-orange-700" : "bg-orange-100 text-orange-700"}`}>
                {visibleUndertimePending!.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {viewMode === "undertime" ? (
        /* ── Undertime review view ─────────────────────────────────────── */
        <div className="space-y-3">
          {payrollReviewScope && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
              <span>Showing pending reviews for this payroll ({payrollReviewScope.from} to {payrollReviewScope.to}).</span>
              <button type="button" className="font-semibold text-primary underline" onClick={() => {
                setPayrollReviewScope(null);
                window.history.replaceState(window.history.state, "", window.location.pathname);
              }}>Show all pending reviews</button>
            </div>
          )}
          <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-muted/30">
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Employee</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Date</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Clock Out</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Undertime</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {utLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>{[...Array(6)].map((_, j) => (
                    <td key={j} className="px-5 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              ) : !visibleUndertimePending?.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    No undertime records pending review. All caught up!
                  </td>
                </tr>
              ) : visibleUndertimePending.map((item, i) => {
                const ut = item.summary;
                const deduction = parseFloat(ut?.undertimeDeductionAmount ?? "0");
                return (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-foreground">
                        {item.employee?.firstName} {item.employee?.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{item.employee?.employeeCode}</div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">
                      {ut?.date ? format(new Date(ut.date + "T00:00:00"), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-foreground">{formatTime(item.log?.clockOutAt)}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-orange-700">{ut?.undertimeMinutes ?? 0} min</div>
                      {deduction > 0 && (
                        <div className="text-xs text-red-600 font-medium">−₱{deduction.toFixed(2)}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell text-muted-foreground text-xs">
                      {item.log?.earlyClockOutReason
                        ? REASON_LABELS[item.log.earlyClockOutReason] ?? item.log.earlyClockOutReason
                        : "—"}
                      {item.log?.earlyClockOutNote && (
                        <div className="italic text-xs mt-0.5">{item.log.earlyClockOutNote}</div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          placeholder="Admin note (optional)"
                          value={ut ? (reviewNotes[ut.id] ?? "") : ""}
                          onChange={(e) => ut && setReviewNotes((prev) => ({ ...prev, [ut.id]: e.target.value }))}
                          className="w-full px-2 py-1.5 text-xs border border-input rounded-md bg-background text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => ut && handleReview(ut.id, "approved")}
                            disabled={reviewMutation.isPending}
                            title="Approve excuse — waive the deduction"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Approve (Waive)
                          </button>
                          <button
                            onClick={() => ut && handleReview(ut.id, "rejected")}
                            disabled={reviewMutation.isPending}
                            title="Reject excuse — keep the deduction"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject (Deduct)
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          </div>
        </div>
      ) : (
        /* ── Regular attendance logs view ─────────────────────────────── */
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="w-4 h-4" />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All employees</option>
              {employees?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName} ({e.employeeCode})
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All statuses</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="missing_logout">No Clock-Out</option>
            </select>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => { setFrom(format(subDays(new Date(), 6), "yyyy-MM-dd")); setTo(today); setEmployeeId(""); setStatus(""); }}
                className="text-xs text-muted-foreground hover:text-foreground border border-input px-2 py-1.5 rounded-md transition-colors"
              >
                Last 7 days
              </button>
              <button
                onClick={() => { setFrom(format(new Date(), "yyyy-MM") + "-01"); setTo(today); setEmployeeId(""); setStatus(""); }}
                className="text-xs text-muted-foreground hover:text-foreground border border-input px-2 py-1.5 rounded-md transition-colors"
              >
                This month
              </button>
              {isFiltered && (
                <button
                  onClick={() => { setFrom(today); setTo(today); setEmployeeId(""); setStatus(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-card-border rounded-lg overflow-hidden">
            <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-muted/30">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Employee</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Date</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Clock In</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Clock Out</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Hours</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Overtime</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Undertime</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Deduction</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}>{[...Array(10)].map((_, j) => (
                      <td key={j} className="px-5 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                ) : !logs?.length ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-muted-foreground text-sm">
                      No attendance records for the selected filters.
                    </td>
                  </tr>
                ) : logs.map((item, i) => {
                  const statusInfo = STATUS_LABELS[item.summary?.status ?? ""] ?? null;
                  const lateDeduction = parseFloat(item.summary?.lateDeductionAmount ?? "0");
                  const undertimeMinutes = item.summary?.undertimeMinutes ?? 0;
                  const undertimeDeduction = parseFloat(item.summary?.undertimeDeductionAmount ?? "0");
                  const utStatus = item.summary?.undertimeStatus ?? null;
                  const utStatusInfo = utStatus ? UT_STATUS_LABELS[utStatus] : null;
                  return (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-medium text-foreground">
                          {item.employee?.firstName} {item.employee?.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">{item.employee?.employeeCode}</div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">
                        {item.log.date ? format(new Date(item.log.date + "T00:00:00"), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-foreground">{formatTime(item.log.clockInAt)}</div>
                        {item.log.clockInPhotoUrl && (
                          <a href={item.log.clockInPhotoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline underline-offset-1">photo</a>
                        )}
                        {item.corrections?.length ? (
                          <div className="mt-1 text-[11px] text-amber-700">
                            <History className="inline w-3 h-3 mr-0.5" />
                            {item.corrections.length} correction{item.corrections.length === 1 ? "" : "s"}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-foreground">{formatTime(item.log.clockOutAt)}</div>
                        {item.log.clockOutPhotoUrl && (
                          <a href={item.log.clockOutPhotoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline underline-offset-1">photo</a>
                        )}
                        {item.log.earlyClockOutReason && (
                          <div className="text-xs text-orange-600 mt-0.5">{REASON_LABELS[item.log.earlyClockOutReason] ?? item.log.earlyClockOutReason}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">
                        {item.summary?.regularHours ? `${item.summary.regularHours}h` : "—"}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        {item.overtimeHours ? (
                          <span className="font-medium text-emerald-700">+{item.overtimeHours}h</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        {undertimeMinutes > 0 ? (
                          <div>
                            <div className="text-sm font-medium text-orange-700">{undertimeMinutes}m short</div>
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
                      <td className="px-5 py-3 hidden lg:table-cell">
                        {(lateDeduction > 0 || undertimeDeduction > 0) ? (
                          <div>
                            {lateDeduction > 0 && (
                              <div className="text-sm font-medium text-red-600">Late −₱{lateDeduction.toFixed(2)}</div>
                            )}
                            {undertimeDeduction > 0 && (
                              <div className="text-sm font-medium text-orange-700">UT −₱{undertimeDeduction.toFixed(2)}</div>
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
                            {item.summary?.isLate && item.summary.lateMinutes > 0 ? ` (+${item.summary.lateMinutes}m)` : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openCorrection(item)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-md hover:bg-primary/10 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Correct
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
          {correctionItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="correction-title">
              <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-card-border bg-card shadow-xl">
                <div className="flex items-start justify-between border-b border-card-border px-5 py-4">
                  <div>
                    <h2 id="correction-title" className="font-semibold text-foreground">Correct attendance and payroll values</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {correctionItem.employee?.firstName} {correctionItem.employee?.lastName} · {correctionItem.log.date}
                    </p>
                  </div>
                  <button type="button" onClick={closeCorrection} className="text-muted-foreground hover:text-foreground" aria-label="Close correction dialog">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleCorrection} className="space-y-4 px-5 py-5">
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                     Use this for fieldwork or a documented exception. Original values remain in the audit history. Draft payroll is invalidated for regeneration; approved or paid periods cannot be edited.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Clock-in
                      <input
                        type="datetime-local"
                        value={correctionClockIn}
                        onChange={(e) => setCorrectionClockIn(e.target.value)}
                        className="mt-1.5 w-full px-3 py-2 text-sm font-normal border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Clock-out
                      <input
                        type="datetime-local"
                        value={correctionClockOut}
                        onChange={(e) => setCorrectionClockOut(e.target.value)}
                        className="mt-1.5 w-full px-3 py-2 text-sm font-normal border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                  </div>
                   <div className="grid sm:grid-cols-2 gap-4">
                     <label className="text-xs font-semibold text-muted-foreground">
                       Daily rate for this date
                       <input type="number" min="0" step="0.01" inputMode="decimal" value={correctionDailyRate} onChange={(e) => setCorrectionDailyRate(e.target.value)} className="mt-1.5 w-full px-3 py-2 text-sm font-normal border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                       <span className="mt-1 block font-normal">Overrides the employee rate for this date only.</span>
                     </label>
                     <label className="text-xs font-semibold text-muted-foreground">
                       Late deduction
                       <input type="number" min="0" step="0.01" inputMode="decimal" value={correctionLateDeduction} onChange={(e) => setCorrectionLateDeduction(e.target.value)} className="mt-1.5 w-full px-3 py-2 text-sm font-normal border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                       <span className="mt-1 block font-normal">Payroll uses this amount for this date.</span>
                     </label>
                   </div>
                   <label className="block text-xs font-semibold text-muted-foreground">
                     Approved overtime hours
                     <input
                       type="number"
                       min="0"
                       max="24"
                       step="0.01"
                       inputMode="decimal"
                       value={correctionOvertimeHours}
                       onChange={(e) => setCorrectionOvertimeHours(e.target.value)}
                       placeholder={correctionItem.overtimeHours ? "0.00" : "Enter hours to add overtime"}
                       className="mt-1.5 w-full px-3 py-2 text-sm font-normal border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                     />
                     <span className="mt-1 block font-normal text-muted-foreground">
                       Add manual overtime when none exists, or edit the single finalized OT record. Payroll uses this approved value.
                     </span>
                   </label>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Required reason
                    <textarea
                      required
                      minLength={1}
                      maxLength={500}
                      rows={3}
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      placeholder="Example: Employee was assigned to client fieldwork and could not use the gate kiosk."
                      className="mt-1.5 w-full px-3 py-2 text-sm font-normal border border-input rounded-md bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  {correctionItem.corrections?.length ? (
                    <div className="rounded-md border border-border p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground"><History className="w-3.5 h-3.5" /> Audit history</div>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {correctionItem.corrections.map((correction) => (
                          <div key={correction.id} className="text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {correction.field === "clock_in"
                                ? "Clock-in"
                                : correction.field === "clock_out"
                                  ? "Clock-out"
                                  : correction.field === "daily_rate"
                                    ? "Daily rate"
                                    : "Late deduction"}
                            </span>
                            {" changed by "}{correction.correctedByName}{" on "}{format(new Date(correction.createdAt), "MMM d, yyyy h:mm a")}
                            {correction.previousAmount !== null && correction.newAmount !== null && (
                              <div>₱{Number(correction.previousAmount).toFixed(2)} → ₱{Number(correction.newAmount).toFixed(2)}</div>
                            )}
                            <div className="italic">{correction.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
                    <button type="button" onClick={closeCorrection} className="px-4 py-2.5 text-sm border border-input rounded-md text-foreground hover:bg-muted/40 transition-colors">
                      Cancel
                    </button>
                    <button type="submit" disabled={correctionMutation.isPending} className="px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-60">
                      {correctionMutation.isPending ? "Saving…" : "Save correction"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="manual-attendance-title">
          <div className="w-full max-w-lg rounded-lg border border-card-border bg-card shadow-xl">
            <div className="flex items-start justify-between border-b border-card-border px-5 py-4">
              <div>
                <h2 id="manual-attendance-title" className="font-semibold text-foreground">Manual attendance entry</h2>
                <p className="mt-1 text-xs text-muted-foreground">For fieldwork, no internet, or a documented missed kiosk entry.</p>
              </div>
              <button type="button" onClick={closeManual} className="text-muted-foreground hover:text-foreground" aria-label="Close manual attendance dialog">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleManual} className="space-y-4 px-5 py-5">
              <p className="rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">
                Enter the employee&apos;s local Philippine date and time. The original manual action, admin, and reason will remain in the audit history.
              </p>
              <label className="block text-xs font-semibold text-muted-foreground">
                Employee
                <select
                  required
                  value={manualEmployeeId}
                  onChange={(e) => setManualEmployeeId(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 text-sm font-normal border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select an active employee</option>
                  {employees?.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.firstName} {employee.lastName} ({employee.employeeCode})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-xs font-semibold text-muted-foreground">
                  Philippine date
                  <input
                    required
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="mt-1.5 w-full px-3 py-2 text-sm font-normal border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="text-xs font-semibold text-muted-foreground">
                  Action
                  <select
                    required
                    value={manualAction}
                    onChange={(e) => setManualAction(e.target.value as ManualAction)}
                    className="mt-1.5 w-full px-3 py-2 text-sm font-normal border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="clock_in">Clock in</option>
                    <option value="clock_out">Clock out</option>
                  </select>
                </label>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-xs font-semibold text-muted-foreground">
                  Philippine time
                  <input
                    required
                    type="time"
                    value={manualTime}
                    onChange={(e) => setManualTime(e.target.value)}
                    className="mt-1.5 w-full px-3 py-2 text-sm font-normal border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                {activeRules.length > 1 ? (
                  <label className="text-xs font-semibold text-muted-foreground">
                    Attendance rule
                    <select
                      value={manualRuleId}
                      onChange={(e) => setManualRuleId(e.target.value)}
                      className="mt-1.5 w-full px-3 py-2 text-sm font-normal border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {activeRules.map((rule) => (
                        <option key={rule.id} value={rule.id}>{rule.name}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="flex items-end pb-2 text-xs text-muted-foreground">
                    {activeRules[0] ? `Rule: ${activeRules[0].name}` : "No active attendance rule"}
                  </div>
                )}
              </div>
              <label className="block text-xs font-semibold text-muted-foreground">
                Required reason
                <textarea
                  required
                  minLength={1}
                  maxLength={500}
                  rows={3}
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="Example: Employee was assigned to client fieldwork and had no internet access."
                  className="mt-1.5 w-full px-3 py-2 text-sm font-normal border border-input rounded-md bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
                <button type="button" onClick={closeManual} className="px-4 py-2.5 text-sm border border-input rounded-md text-foreground hover:bg-muted/40 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={manualMutation.isPending} className="px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-60">
                  {manualMutation.isPending ? "Recording…" : `Record ${manualAction === "clock_in" ? "clock-in" : "clock-out"}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
