import { useRef, useState } from "react";
import {
  useListAdminOvertime,
  useApproveOvertime,
  useRejectOvertime,
  useReviewOvertime,
  useScanUnauthorizedOvertime,
  useAssignOvertime,
  useManuallyRecordOvertime,
  useVoidOvertime,
  useCorrectOvertimeTimeOut,
  useListEmployees,
  getListAdminOvertimeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Clock, CheckCircle, XCircle, AlertTriangle, Search, Star, CalendarPlus, X, MapPin, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ot_requested: { label: "Requested", color: "bg-blue-100 text-blue-700" },
  ot_approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700" },
  ot_rejected: { label: "Rejected", color: "bg-red-100 text-red-700" },
  ot_in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-700" },
  ot_completed_pending_review: { label: "Pending Review", color: "bg-purple-100 text-purple-700" },
  ot_completed: { label: "Completed", color: "bg-gray-100 text-gray-600" },
  ot_voided: { label: "Voided", color: "bg-slate-100 text-slate-600" },
  unauthorized_ot: { label: "Unauthorized", color: "bg-red-100 text-red-700" },
};

const ALL_STATUSES = [
  "ot_requested",
  "ot_approved",
  "ot_rejected",
  "ot_in_progress",
  "ot_completed_pending_review",
  "ot_completed",
  "ot_voided",
  "unauthorized_ot",
];

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return format(new Date(iso), "MMM d, h:mm a");
}

function manilaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function AdminOvertime() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [assignedEmployeeId, setAssignedEmployeeId] = useState("");
  const [assignedDate, setAssignedDate] = useState(manilaDate);
  const [assignedStart, setAssignedStart] = useState("17:00");
  const [assignedEnd, setAssignedEnd] = useState("19:00");
  const [assignedReason, setAssignedReason] = useState("");
  const [manualEmployeeId, setManualEmployeeId] = useState("");
  const [manualDate, setManualDate] = useState(manilaDate);
  const [manualIn, setManualIn] = useState("17:00");
  const [manualOut, setManualOut] = useState("19:00");
  const [manualReason, setManualReason] = useState("");

  // Inline action state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewHours, setReviewHours] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctedOut, setCorrectedOut] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const scanInFlightRef = useRef(false);
  const [scanInFlight, setScanInFlight] = useState(false);

  const params = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(dateFilter ? { date: dateFilter } : {}),
  };

  const { data: rows, isLoading } = useListAdminOvertime(params);
  const { data: employees } = useListEmployees({ status: "active" });

  const approveMutation = useApproveOvertime();
  const rejectMutation = useRejectOvertime();
  const reviewMutation = useReviewOvertime();
  const scanMutation = useScanUnauthorizedOvertime();
  const assignMutation = useAssignOvertime();
  const manualMutation = useManuallyRecordOvertime();
  const voidMutation = useVoidOvertime();
  const correctTimeOutMutation = useCorrectOvertimeTimeOut();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListAdminOvertimeQueryKey(params) });

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync({ id });
      toast({ title: "OT request approved" });
      invalidate();
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      toast({ title: "Approve failed", description: e?.data?.error ?? e?.message ?? "Error", variant: "destructive" });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectMutation.mutateAsync({ id, data: { adminNotes: rejectNotes || undefined } });
      toast({ title: "OT request rejected" });
      setRejectingId(null);
      setRejectNotes("");
      invalidate();
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      toast({ title: "Reject failed", description: e?.data?.error ?? e?.message ?? "Error", variant: "destructive" });
    }
  };

  const handleReview = async (id: string) => {
    const hrs = parseFloat(reviewHours);
    if (isNaN(hrs) || hrs < 0) {
      toast({ title: "Invalid hours", description: "Enter a valid number ≥ 0", variant: "destructive" });
      return;
    }
    try {
      await reviewMutation.mutateAsync({ id, data: { approvedOvertimeHours: hrs, adminNotes: reviewNotes || undefined } });
      toast({ title: "OT finalized — hours saved to payroll" });
      setReviewingId(null);
      setReviewHours("");
      setReviewNotes("");
      invalidate();
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      toast({ title: "Review failed", description: e?.data?.error ?? e?.message ?? "Error", variant: "destructive" });
    }
  };

  const handleVoid = async (id: string) => {
    if (!voidReason.trim()) {
      toast({ title: "Void reason is required", variant: "destructive" });
      return;
    }
    try {
      await voidMutation.mutateAsync({ id, data: { reason: voidReason.trim() } });
      toast({ title: "Overtime voided", description: "The original timestamps were retained and zero hours will enter payroll." });
      setVoidingId(null);
      setVoidReason("");
      invalidate();
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      toast({ title: "Void failed", description: e?.data?.error ?? e?.message ?? "Error", variant: "destructive" });
    }
  };

  const handleCorrectTimeOut = async (id: string) => {
    if (!correctedOut || !correctionReason.trim()) {
      toast({ title: "OT time-out and correction reason are required", variant: "destructive" });
      return;
    }
    try {
      await correctTimeOutMutation.mutateAsync({
        id,
        data: { otOutTime: correctedOut, reason: correctionReason.trim() },
      });
      toast({ title: "OT time-out corrected", description: "The record is now pending review and the original values were preserved." });
      setCorrectingId(null);
      setCorrectedOut("");
      setCorrectionReason("");
      invalidate();
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      toast({ title: "Correction failed", description: e?.data?.error ?? e?.message ?? "Error", variant: "destructive" });
    }
  };

  const handleScan = async () => {
    if (scanInFlightRef.current || scanMutation.isPending) return;
    scanInFlightRef.current = true;
    setScanInFlight(true);
    try {
      const result = await scanMutation.mutateAsync();
      toast({ title: `Scan complete — ${result.created} unauthorized OT record(s) created` });
      invalidate();
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      toast({ title: "Scan failed", description: e?.data?.error ?? e?.message ?? "Error", variant: "destructive" });
    } finally {
      scanInFlightRef.current = false;
      setScanInFlight(false);
    }
  };

  const handleAssign = async () => {
    if (!assignedEmployeeId || !assignedDate || !assignedStart || !assignedEnd) {
      toast({ title: "Complete the employee, date, and time fields", variant: "destructive" });
      return;
    }
    try {
      await assignMutation.mutateAsync({
        data: {
          employeeId: assignedEmployeeId,
          periodDate: assignedDate,
          plannedStartTime: assignedStart,
          plannedEndTime: assignedEnd,
          otReason: assignedReason.trim() || undefined,
        },
      });
      toast({ title: "Overtime assigned", description: "It will auto-start when the employee opens their dashboard during the scheduled period." });
      setAssignmentOpen(false);
      setAssignedEmployeeId("");
      setAssignedReason("");
      invalidate();
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      toast({ title: "Assignment failed", description: e?.data?.error ?? e?.message ?? "Error", variant: "destructive" });
    }
  };

  const handleManualRecord = async () => {
    if (!manualEmployeeId || !manualDate || !manualIn || !manualOut) {
      toast({ title: "Complete the employee, date, and time fields", variant: "destructive" });
      return;
    }
    try {
      await manualMutation.mutateAsync({
        data: {
          employeeId: manualEmployeeId,
          periodDate: manualDate,
          otInTime: manualIn,
          otOutTime: manualOut,
          otReason: manualReason.trim() || undefined,
        },
      });
      toast({
        title: "Field overtime recorded",
        description: "Review and finalize the hours before payroll.",
      });
      setManualOpen(false);
      setManualEmployeeId("");
      setManualReason("");
      invalidate();
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      toast({ title: "Recording failed", description: e?.data?.error ?? e?.message ?? "Error", variant: "destructive" });
    }
  };

  return (
    <div className="page-container">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Overtime Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review, approve, and finalize employee overtime.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setManualOpen(false);
              setAssignmentOpen((open) => !open);
            }}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {assignmentOpen ? <X className="w-4 h-4" /> : <CalendarPlus className="w-4 h-4" />}
            {assignmentOpen ? "Close Assignment" : "Assign Overtime"}
          </button>
          <button
            onClick={() => {
              setAssignmentOpen(false);
              setManualOpen((open) => !open);
            }}
            className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            {manualOpen ? <X className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
            {manualOpen ? "Close Field OT" : "Record Field OT"}
          </button>
          <button
            onClick={handleScan}
            disabled={scanMutation.isPending || scanInFlight}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-input rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {scanMutation.isPending || scanInFlight ? "Scanning…" : "Scan Unauthorized OT"}
          </button>
        </div>
      </div>

      {assignmentOpen && (
        <div className="mb-5 rounded-lg border border-primary/20 bg-card p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-foreground">Assign employee overtime</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              For early OT, use a window such as 07:00–08:00. The employee scans the gate QR once to start OT; regular attendance then begins automatically at 08:00 and continues to the normal shift end.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</span>
              <select
                value={assignedEmployeeId}
                onChange={(event) => setAssignedEmployeeId(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select employee…</option>
                {(employees ?? []).map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName} ({employee.employeeCode})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</span>
              <input
                type="date"
                value={assignedDate}
                onChange={(event) => setAssignedDate(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start</span>
                <input
                  type="time"
                  value={assignedStart}
                  onChange={(event) => setAssignedStart(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">End</span>
                <input
                  type="time"
                  value={assignedEnd}
                  onChange={(event) => setAssignedEnd(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
            <label className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason or task (optional)</span>
              <input
                type="text"
                value={assignedReason}
                onChange={(event) => setAssignedReason(event.target.value)}
                placeholder="e.g. Complete production backlog"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <button
              type="button"
              onClick={handleAssign}
              disabled={assignMutation.isPending}
              className="self-end rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {assignMutation.isPending ? "Assigning…" : "Assign Overtime"}
            </button>
          </div>
        </div>
      )}

      {manualOpen && (
        <div className="mb-5 rounded-lg border border-primary/20 bg-card p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-foreground">Record field-work overtime</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter the employee’s actual OT time-in and time-out. Office QR proof is not required.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</span>
              <select
                value={manualEmployeeId}
                onChange={(event) => setManualEmployeeId(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select employee…</option>
                {(employees ?? []).map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName} ({employee.employeeCode})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</span>
              <input
                type="date"
                value={manualDate}
                onChange={(event) => setManualDate(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">OT In</span>
                <input
                  type="time"
                  value={manualIn}
                  onChange={(event) => setManualIn(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">OT Out</span>
                <input
                  type="time"
                  value={manualOut}
                  onChange={(event) => setManualOut(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
            <label className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Field-work reason (optional)</span>
              <input
                type="text"
                value={manualReason}
                onChange={(event) => setManualReason(event.target.value)}
                placeholder="e.g. Client installation at off-site location"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <button
              type="button"
              onClick={handleManualRecord}
              disabled={manualMutation.isPending}
              className="self-end rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {manualMutation.isPending ? "Recording…" : "Record Field OT"}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter("")}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              !statusFilter
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-input"
            }`}
          >
            All
          </button>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? "" : s)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-input"
              }`}
            >
              {STATUS_LABELS[s]?.label ?? s}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="ml-0 w-full sm:ml-auto sm:w-auto px-2 py-2 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Filter by date"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
        ) : !rows?.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No overtime records found.</div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((item) => {
              const ot = item.overtimeLog;
              const emp = item.employee;
              const statusInfo = STATUS_LABELS[ot.status] ?? { label: ot.status, color: "bg-gray-100 text-gray-600" };
              const isRejectingThis = rejectingId === ot.id;
              const isReviewingThis = reviewingId === ot.id;
              const isVoidingThis = voidingId === ot.id;
              const isCorrectingThis = correctingId === ot.id;
              const isMissingOtOut =
                ot.status === "ot_in_progress" &&
                !ot.otOutTime &&
                ot.periodDate < manilaDate();
              const visibleStatus = isMissingOtOut
                ? { label: "Missing OT Out", color: "bg-red-100 text-red-700" }
                : statusInfo;

              return (
                <div key={ot.id} className="px-5 py-4">
                  <div className="flex items-start gap-4 flex-wrap">
                    {/* Employee + date info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">
                          {emp?.firstName} {emp?.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">{emp?.employeeCode}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${visibleStatus.color}`}>
                          {visibleStatus.label}
                        </span>
                        {ot.status === "unauthorized_ot" && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <div>Date: <span className="text-foreground font-medium">{ot.periodDate}</span></div>
                        {ot.assignmentSource === "admin_assignment" && (
                          <div className="font-medium text-primary">
                            Admin assigned: {ot.plannedStartTime}–{ot.plannedEndTime}
                          </div>
                        )}
                        {ot.assignmentSource === "admin_manual" && (
                          <div className="font-medium text-primary">Field OT — manually recorded by admin</div>
                        )}
                        {ot.otReason && <div>Reason: {ot.otReason}</div>}
                        {ot.otInTime && <div>OT In: {formatTime(ot.otInTime)}</div>}
                        {ot.otOutTime && <div>OT Out: {formatTime(ot.otOutTime)}</div>}
                        {ot.approvedOvertimeHours && (
                          <div className="text-emerald-700 font-medium">
                            Approved hours: {parseFloat(ot.approvedOvertimeHours).toFixed(2)}h
                          </div>
                        )}
                        {ot.adminNotes && <div className="italic text-muted-foreground">Note: {ot.adminNotes}</div>}
                        {ot.approvedByName && (
                          <div>Approved by: {ot.approvedByName}</div>
                        )}
                        {isMissingOtOut && (
                          <div className="font-semibold text-red-600">
                            This overtime passed midnight Manila time without a time-out. Admin correction or voiding is required.
                          </div>
                        )}
                        {ot.voidedByName && <div>Voided by: {ot.voidedByName}</div>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex w-full sm:w-auto items-center gap-2 flex-shrink-0 flex-wrap">
                      {(ot.status === "ot_requested" || ot.status === "unauthorized_ot") && !isRejectingThis && (
                        <>
                          <button
                            onClick={() => handleApprove(ot.id)}
                            disabled={approveMutation.isPending}
                            className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => { setRejectingId(ot.id); setRejectNotes(""); }}
                            className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium border border-destructive text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}
                      {ot.status === "ot_completed_pending_review" && !isReviewingThis && (
                        <button
                          onClick={() => { setReviewingId(ot.id); setReviewHours(""); setReviewNotes(""); }}
                          className="flex w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                        >
                          <Star className="w-3.5 h-3.5" /> Set Hours
                        </button>
                      )}
                      {["ot_approved", "ot_in_progress", "ot_completed_pending_review"].includes(ot.status) && !isVoidingThis && (
                        <button
                          onClick={() => {
                            setReviewingId(null);
                            setVoidingId(ot.id);
                            setVoidReason("");
                          }}
                          className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-md border border-destructive px-3 py-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <Ban className="w-3.5 h-3.5" /> Void Overtime
                        </button>
                      )}
                      {isMissingOtOut && !isCorrectingThis && (
                        <button
                          onClick={() => {
                            setVoidingId(null);
                            setCorrectingId(ot.id);
                            setCorrectedOut("");
                            setCorrectionReason("");
                          }}
                          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-purple-600 px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-purple-700 sm:w-auto"
                        >
                          <Clock className="w-3.5 h-3.5" /> Enter OT Time-Out
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline reject form */}
                  {isRejectingThis && (
                    <div className="mt-3 p-3 bg-muted/40 rounded-md border border-input space-y-2">
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Rejection notes (optional)
                      </label>
                      <textarea
                        rows={2}
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        placeholder="Reason for rejection…"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(ot.id)}
                          disabled={rejectMutation.isPending}
                          className="px-3 py-1.5 text-xs font-medium bg-destructive text-white rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50"
                        >
                          {rejectMutation.isPending ? "Rejecting…" : "Confirm Reject"}
                        </button>
                        <button
                          onClick={() => setRejectingId(null)}
                          className="px-3 py-1.5 text-xs font-medium border border-input rounded-md text-muted-foreground hover:bg-muted/40 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline review form */}
                  {isReviewingThis && (
                    <div className="mt-3 p-3 bg-muted/40 rounded-md border border-input space-y-2">
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Set Approved Overtime Hours
                      </label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={reviewHours}
                          onChange={(e) => setReviewHours(e.target.value)}
                          className="w-full sm:w-28 px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="e.g. 2.5"
                        />
                        <input
                          type="text"
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          className="flex-1 px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="Admin notes (optional)"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Payroll uses this employee's overtime rate per hour when set; otherwise it uses daily rate ÷ 8 × 1.25.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(ot.id)}
                          disabled={reviewMutation.isPending}
                          className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                          {reviewMutation.isPending ? "Saving…" : "Save & Finalize"}
                        </button>
                        <button
                          onClick={() => setReviewingId(null)}
                          className="px-3 py-1.5 text-xs font-medium border border-input rounded-md text-muted-foreground hover:bg-muted/40 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {isVoidingThis && (
                    <div className="mt-3 space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-destructive">
                        Reason for voiding this overtime
                      </label>
                      <textarea
                        rows={2}
                        value={voidReason}
                        onChange={(event) => setVoidReason(event.target.value)}
                        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="e.g. Employee accidentally started OT and did not perform overtime work"
                      />
                      <p className="text-xs text-muted-foreground">
                        The record and original OT timestamps will be retained. Voided overtime contributes zero payroll hours.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVoid(ot.id)}
                          disabled={voidMutation.isPending}
                          className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
                        >
                          {voidMutation.isPending ? "Voiding…" : "Confirm Void"}
                        </button>
                        <button
                          onClick={() => setVoidingId(null)}
                          className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/40"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {isCorrectingThis && (
                    <div className="mt-3 space-y-2 rounded-md border border-purple-300 bg-purple-50/50 p-3">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-purple-700">
                        Verified OT time-out
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="time"
                          value={correctedOut}
                          onChange={(event) => setCorrectedOut(event.target.value)}
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        />
                        <input
                          type="text"
                          value={correctionReason}
                          onChange={(event) => setCorrectionReason(event.target.value)}
                          placeholder="Required correction reason"
                          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Saving moves this record to Pending Review. The original and corrected values are retained in the audit history.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCorrectTimeOut(ot.id)}
                          disabled={correctTimeOutMutation.isPending}
                          className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {correctTimeOutMutation.isPending ? "Saving…" : "Save OT Time-Out"}
                        </button>
                        <button
                          onClick={() => setCorrectingId(null)}
                          className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
