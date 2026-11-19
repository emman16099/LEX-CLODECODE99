import { useRef, useState, useEffect, useCallback } from "react";
import {
  useGetMyAttendanceToday,
  useClockIn,
  useClockOut,
  getGetMyAttendanceTodayQueryKey,
  useListAttendanceRules,
  useGetMyOvertimeRequests,
  useRequestOvertime,
  useOvertimeClockIn,
  useOvertimeClockOut,
  useAutoStartAssignedOvertime,
  getGetMyOvertimeRequestsQueryKey,
} from "@workspace/api-client-react";
import { Html5Qrcode } from "html5-qrcode";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { QrCode, ScanLine, X, Clock, CheckCircle, AlertTriangle, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAppUser } from "@/hooks/useAppUser";
import { BadgeCheck, UserRound } from "lucide-react";

type Step = "idle" | "scanning" | "reason" | "clocking";

function extractGateToken(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    const token = url.searchParams.get("gate");
    if (token) return token;
  } catch {
    // Fall through and accept a raw signed token.
  }
  return value.includes(".") ? value.trim() : null;
}

const EARLY_REASONS = [
  { value: "undertime", label: "Undertime (no excuse)" },
  { value: "approved_leave", label: "Approved Leave" },
  { value: "official_errand", label: "Official Errand" },
  { value: "approved_exception", label: "Approved Exception" },
] as const;

function useLiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function manilaDate(timestamp: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(timestamp);
}

function formatManilaTime(timestamp: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

const OT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ot_requested: { label: "Awaiting Approval", color: "bg-blue-100 text-blue-700" },
  ot_approved: { label: "Approved — Ready to Clock In", color: "bg-emerald-100 text-emerald-700" },
  ot_rejected: { label: "Rejected", color: "bg-red-100 text-red-700" },
  ot_in_progress: { label: "OT In Progress", color: "bg-amber-100 text-amber-700" },
  ot_completed_pending_review: { label: "Completed — Pending Admin Review", color: "bg-purple-100 text-purple-700" },
  ot_completed: { label: "Completed & Finalized", color: "bg-gray-100 text-gray-600" },
  unauthorized_ot: { label: "Unauthorized OT Detected", color: "bg-red-100 text-red-700" },
};

// The browser suite uses a deterministic proof so it can exercise the clock-in
// and clock-out handlers without requiring a camera in CI. This is stripped
// from production builds because VITE_E2E is only set by the test web server.
const e2eFixtureMode = import.meta.env.VITE_E2E === "true";

export default function EmployeeDashboard() {
  const now = useLiveClock();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { appUser } = useAppUser();
  const employee = appUser?.employeeProfile;

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const submissionStartedRef = useRef(false);
  const scanActionRef = useRef<"clockin" | "clockout">("clockin");
  const scanEarlyRef = useRef(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [gateProof, setGateProof] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  // Undertime reason state
  const [earlyReason, setEarlyReason] = useState<string>("");
  const [earlyNote, setEarlyNote] = useState("");

  // OT-specific state
  const [showOTForm, setShowOTForm] = useState(false);
  const [otReason, setOtReason] = useState("");
  const [otAction, setOtAction] = useState<"none" | "clockin" | "clockout">("none");

  const { data: todayData, isLoading: loadingToday } = useGetMyAttendanceToday();
  const { data: rules } = useListAttendanceRules();
  const { data: myOTRequests } = useGetMyOvertimeRequests();
  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();
  const requestOTMutation = useRequestOvertime();
  const otClockInMutation = useOvertimeClockIn();
  const otClockOutMutation = useOvertimeClockOut();
  const autoStartOTMutation = useAutoStartAssignedOvertime();
  const autoStartAttemptedRef = useRef<string | null>(null);

  const hasClockedIn = !!todayData?.log?.clockInAt;
  const hasClockedOut = !!todayData?.log?.clockOutAt;
  const regularClockInAt = todayData?.log?.clockInAt
    ? new Date(todayData.log.clockInAt)
    : null;
  const regularShiftPending =
    Boolean(regularClockInAt) &&
    !hasClockedOut &&
    regularClockInAt!.getTime() > now.getTime();
  const action = hasClockedIn
    ? hasClockedOut
      ? "done"
      : regularShiftPending
        ? "pending"
        : "clockout"
    : "clockin";

  const todayStr = manilaDate(now);
  const todayOT = myOTRequests?.find((r) => r.periodDate === todayStr) ?? null;

  useEffect(() => {
    if (!myOTRequests || autoStartAttemptedRef.current === todayStr) return;
    const assignedToday = myOTRequests.find(
      (request) =>
        request.periodDate === todayStr &&
        request.assignmentSource === "admin_assignment" &&
        request.status === "ot_approved",
    );
    if (!assignedToday) return;
    autoStartAttemptedRef.current = todayStr;
    void autoStartOTMutation.mutateAsync().then((result) => {
      if (!result.started) return;
      toast({ title: "Assigned overtime started automatically" });
      queryClient.invalidateQueries({ queryKey: getGetMyOvertimeRequestsQueryKey() });
    }).catch(() => {
      autoStartAttemptedRef.current = null;
    });
  }, [autoStartOTMutation, myOTRequests, queryClient, todayStr, toast]);

  useEffect(() => {
    if (
      todayOT?.assignmentSource !== "admin_assignment" ||
      todayOT.status !== "ot_in_progress" ||
      !todayOT.plannedEndTime
    ) {
      return;
    }

    const plannedEnd = new Date(`${todayOT.periodDate}T${todayOT.plannedEndTime}:00+08:00`);
    const delay = Math.max(0, plannedEnd.getTime() - Date.now());
    const timer = window.setTimeout(() => {
      void autoStartOTMutation.mutateAsync().then((result) => {
        if (result.overtimeLog?.status === "ot_completed_pending_review") {
          toast({ title: "Early overtime completed — regular shift started" });
          queryClient.invalidateQueries({ queryKey: getGetMyOvertimeRequestsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMyAttendanceTodayQueryKey() });
        }
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [autoStartOTMutation, queryClient, todayOT, toast]);

  // Detect if employee would be leaving early (PHT wall-clock vs shiftEnd of rule used at clock-in)
  const clockInRuleId = todayData?.log?.attendanceRuleId ?? null;
  const clockInRule = rules?.find((r) => r.id === clockInRuleId) ?? null;
  const isLeavingEarly = action === "clockout" && clockInRule
    ? (() => {
        const phtParts = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(now);
        const phtH = parseInt(phtParts.find((p) => p.type === "hour")!.value, 10);
        const phtM = parseInt(phtParts.find((p) => p.type === "minute")!.value, 10);
        const nowMinutes = phtH * 60 + phtM;
        const shiftEndMinutes = parseTimeToMinutes(clockInRule.shiftEnd);
        return nowMinutes < shiftEndMinutes;
      })()
    : false;

  const verifyGate = useCallback(async (token: string) => {
    try {
      const response = await fetch("/api/auth/gate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Gate QR verification failed");
      }
      const data = await response.json() as { proof: string };
      setGateProof(data.proof);
      setScannerError(null);
      setStep(scanActionRef.current === "clockout" && scanEarlyRef.current ? "reason" : "clocking");
    } catch (error) {
      setScannerError(error instanceof Error ? error.message : "Gate QR verification failed");
      setStep("scanning");
    }
  }, []);

  const submit = useCallback(async (proof: string, intendedAction: "clockin" | "clockout") => {
    if (submissionStartedRef.current) return;
    submissionStartedRef.current = true;
    setStep("clocking");
    try {
      if (intendedAction === "clockin") {
        await clockInMutation.mutateAsync({
          data: { gateProof: proof, attendanceRuleId: selectedRuleId },
        });
        toast({ title: "Clocked in successfully" });
      } else {
        await clockOutMutation.mutateAsync({
          data: {
            gateProof: proof,
            earlyClockOutReason: (earlyReason || null) as "undertime" | "approved_leave" | "official_errand" | "approved_exception" | null,
            earlyClockOutNote: earlyNote.trim() || null,
          },
        });
        toast({ title: "Clocked out successfully" });
      }

      void autoStartOTMutation.mutateAsync().then((overtimeResult) => {
        if (overtimeResult.overtimeLog?.status === "ot_completed_pending_review") {
          toast({ title: "Early overtime completed — awaiting admin review" });
        }
        queryClient.invalidateQueries({ queryKey: getGetMyOvertimeRequestsQueryKey() });
      }).catch(() => {
        // Attendance was already recorded successfully. Server reconciliation
        // will finish any due early-OT transition.
      });

      queryClient.invalidateQueries({ queryKey: getGetMyAttendanceTodayQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMyOvertimeRequestsQueryKey() });
      setGateProof("");
      setEarlyReason("");
      setEarlyNote("");
      setStep("idle");
      submissionStartedRef.current = false;
    } catch (err: unknown) {
      const error = err as { data?: { error?: string }; message?: string };
      toast({
        title: intendedAction === "clockin" ? "Clock-in failed" : "Clock-out failed",
        description: error.data?.error ?? error.message ?? "Please try again.",
        variant: "destructive",
      });
      setGateProof("");
      setStep("idle");
      submissionStartedRef.current = false;
    }
  }, [autoStartOTMutation, clockInMutation, clockOutMutation, earlyNote, earlyReason, queryClient, selectedRuleId, toast]);

  useEffect(() => {
    if (step !== "scanning") return;
    let disposed = false;
    let accepted = false;
    const scanner = new Html5Qrcode("attendance-gate-qr-reader", false);
    scannerRef.current = scanner;
    setScannerError(null);

    const startPromise = scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 230, height: 230 } },
      (decodedText) => {
        if (accepted) return;
        const token = extractGateToken(decodedText);
        if (!token) {
          setScannerError("This is not the LEXIEBOSS office gate QR.");
          return;
        }
        accepted = true;
        void verifyGate(token);
      },
      () => undefined,
    );
    void startPromise.catch(() => {
      if (!disposed) {
        setScannerError("Camera unavailable. Allow camera access, then try again.");
      }
    });

    return () => {
      disposed = true;
      scannerRef.current = null;
      void (async () => {
        await startPromise.catch(() => undefined);
        if (scanner.isScanning) await scanner.stop().catch(() => undefined);
        scanner.clear();
      })();
    };
  }, [step, verifyGate]);

  useEffect(() => {
    if (
      step === "clocking" &&
      gateProof &&
      !(scanActionRef.current === "clockout" && scanEarlyRef.current)
    ) {
      void submit(gateProof, scanActionRef.current);
    }
  }, [gateProof, step, submit]);

  const handleOTClockIn = async () => {
    if (!todayOT) return;
    setOtAction("clockin");
    try {
      await otClockInMutation.mutateAsync({ id: todayOT.id });
      toast({ title: "OT clock-in recorded" });
      queryClient.invalidateQueries({ queryKey: getGetMyOvertimeRequestsQueryKey() });
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      toast({ title: "OT clock-in failed", description: e?.data?.error ?? e?.message ?? "Error", variant: "destructive" });
    } finally {
      setOtAction("none");
    }
  };

  const handleOTClockOut = async () => {
    if (!todayOT) return;
    setOtAction("clockout");
    try {
      await otClockOutMutation.mutateAsync({ id: todayOT.id });
      toast({ title: "OT clock-out recorded — pending admin review" });
      queryClient.invalidateQueries({ queryKey: getGetMyOvertimeRequestsQueryKey() });
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      toast({ title: "OT clock-out failed", description: e?.data?.error ?? e?.message ?? "Error", variant: "destructive" });
    } finally {
      setOtAction("none");
    }
  };

  const handleRequestOT = async () => {
    if (!otReason.trim()) {
      toast({ title: "Please enter a reason for overtime", variant: "destructive" });
      return;
    }
    try {
      await requestOTMutation.mutateAsync({
        data: { periodDate: todayStr, otReason: otReason.trim() },
      });
      toast({ title: "Overtime request submitted — awaiting admin approval" });
      setShowOTForm(false);
      setOtReason("");
      queryClient.invalidateQueries({ queryKey: getGetMyOvertimeRequestsQueryKey() });
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      toast({ title: "OT request failed", description: e?.data?.error ?? e?.message ?? "Error", variant: "destructive" });
    }
  };

  const statusInfo = todayData?.summary;

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      {employee && (
        <div className="mb-6 rounded-lg border border-card-border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-bold text-foreground">
                  {employee.firstName} {employee.lastName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                  <BadgeCheck className="h-3 w-3" />
                  {employee.employmentStatus}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Employee ID: <strong className="font-mono font-semibold text-foreground">{employee.employeeCode}</strong></span>
                <span>Login: <strong className="font-mono font-semibold text-foreground">{employee.portalUsername ?? employee.employeeCode}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clock & Date */}
      <div className="mb-6 text-center">
        <div className="text-4xl sm:text-5xl font-bold text-foreground tabular-nums tracking-tight">
          {format(now, "h:mm")}
          <span className="text-3xl text-muted-foreground ml-1">{format(now, "ss")}</span>
          <span className="text-2xl ml-2 font-medium text-muted-foreground">{format(now, "a")}</span>
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {format(now, "EEEE, MMMM d, yyyy")}
        </div>
      </div>

      {/* Today status */}
      <div className="bg-card border border-card-border rounded-lg p-5 mb-6">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today's Attendance</div>
        {loadingToday ? (
          <div className="animate-pulse h-10 bg-muted rounded" />
        ) : action === "done" ? (
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
            <div>
              <div className="font-semibold text-foreground text-sm">Day complete</div>
              <div className="text-xs text-muted-foreground">
                In: {todayData?.log?.clockInAt ? format(new Date(todayData.log.clockInAt), "h:mm a") : "—"} &bull;
                Out: {todayData?.log?.clockOutAt ? format(new Date(todayData.log.clockOutAt), "h:mm a") : "—"} &bull;
                {statusInfo?.regularHours ?? "0"}h worked
              </div>
              {(statusInfo?.undertimeMinutes ?? 0) > 0 && (
                <div className="text-xs text-orange-600 mt-0.5">
                  {statusInfo!.undertimeMinutes}m undertime
                  {statusInfo?.undertimeStatus === "pending_review" && " — excuse pending admin review"}
                  {statusInfo?.undertimeStatus === "approved" && " — excuse approved, no deduction"}
                  {statusInfo?.undertimeStatus === "rejected" && ` — excuse rejected, −₱${parseFloat(statusInfo.undertimeDeductionAmount ?? "0").toFixed(2)} deducted`}
                  {!statusInfo?.undertimeStatus && ` — −₱${parseFloat(statusInfo?.undertimeDeductionAmount ?? "0").toFixed(2)} deducted`}
                </div>
              )}
            </div>
            {statusInfo && (
              <span className={cn("ml-auto text-xs px-2 py-0.5 rounded-full font-medium capitalize", {
                "status-present": statusInfo.status === "present",
                "status-late": statusInfo.status === "late",
              })}>
                {statusInfo.status}
                {statusInfo.isLate ? ` (+${statusInfo.lateMinutes}m late)` : ""}
              </span>
            )}
          </div>
        ) : regularShiftPending ? (
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
            <div>
              <div className="font-semibold text-foreground text-sm">Early overtime in progress</div>
              <div className="text-xs text-muted-foreground">
                Regular attendance begins automatically at {regularClockInAt ? formatManilaTime(regularClockInAt) : "shift start"} — no second QR scan needed
              </div>
            </div>
          </div>
        ) : hasClockedIn ? (
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
            <div>
              <div className="font-semibold text-foreground text-sm">Currently clocked in</div>
              <div className="text-xs text-muted-foreground">
                Since {todayData?.log?.clockInAt ? format(new Date(todayData.log.clockInAt), "h:mm a") : "—"}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground flex-shrink-0" />
            <div className="text-sm text-muted-foreground">Not clocked in yet</div>
          </div>
        )}
      </div>

      {/* Regular Clock in/out action */}
      {action !== "done" && action !== "pending" && (
        <div className="bg-card border border-card-border rounded-lg p-5 mb-6">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {action === "clockin" ? "Clock In" : "Clock Out"}
          </div>

          {/* Rule selector (clock-in only) */}
          {action === "clockin" && rules && rules.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Shift Rule (optional)
              </label>
              <select
                value={selectedRuleId ?? ""}
                onChange={(e) => setSelectedRuleId(e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">No rule selected</option>
                {rules.filter((r) => r.isActive).map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.shiftStart} – {r.shiftEnd})</option>
                ))}
              </select>
            </div>
          )}

          {step === "idle" && (
            <div>
              <button
                onClick={() => {
                  scanActionRef.current = action;
                  scanEarlyRef.current = isLeavingEarly;
                  if (e2eFixtureMode) {
                    void submit("e2e-gate-proof", action);
                    return;
                  }
                  setStep("scanning");
                }}
                className="w-full flex items-center justify-center gap-2.5 bg-muted/50 border-2 border-dashed border-input rounded-lg py-10 text-sm text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
              >
                <QrCode className="w-5 h-5" />
                Scan gate QR to {action === "clockin" ? "clock in" : "clock out"}
              </button>
            </div>
          )}

          {step === "scanning" && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-lg border border-input bg-black">
                <div id="attendance-gate-qr-reader" className="min-h-64" />
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ScanLine className="h-4 w-4 text-primary" />
                Scan the QR posted at the office gate
              </div>
              {scannerError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {scannerError}
                </div>
              )}
              <button
                onClick={() => setStep("idle")}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-input py-2 text-sm text-muted-foreground hover:bg-muted/40"
              >
                <X className="h-4 w-4" /> Cancel scan
              </button>
            </div>
          )}

          {step === "reason" && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <LogOut className="w-4 h-4 text-orange-600 flex-shrink-0" />
                  <p className="text-sm font-semibold text-orange-800">
                    You're clocking out early
                    {clockInRule ? ` — shift ends at ${clockInRule.shiftEnd}` : ""}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Reason <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={earlyReason}
                    onChange={(e) => setEarlyReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select a reason…</option>
                    {EARLY_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Additional note (optional)
                  </label>
                  <input
                    type="text"
                    value={earlyNote}
                    onChange={(e) => setEarlyNote(e.target.value)}
                    placeholder="e.g. Doctor's appointment at 4pm"
                    className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setGateProof("");
                    setEarlyReason("");
                    setEarlyNote("");
                    setStep("idle");
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-input rounded-md text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void submit(gateProof, scanActionRef.current)}
                  disabled={!earlyReason}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold py-2 rounded-md transition-colors disabled:opacity-50"
                >
                  Confirm Clock Out
                </button>
              </div>
            </div>
          )}

          {step === "clocking" && (
            <div className="rounded-lg bg-primary/5 py-8 text-center text-sm font-medium text-primary">
              Recording {action === "clockin" ? "clock in" : "clock out"}…
            </div>
          )}
        </div>
      )}

      {/* ── Overtime section (shown once regular day is done) ── */}
      {action === "done" && (
        <div className="bg-card border border-card-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overtime</div>
          </div>

          {!todayOT && (
            <div>
              {showOTForm ? (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Reason for Overtime
                  </label>
                  <textarea
                    rows={3}
                    value={otReason}
                    onChange={(e) => setOtReason(e.target.value)}
                    placeholder="Describe why overtime is needed…"
                    className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                  <div className="flex flex-col-reverse sm:flex-row gap-2">
                    <button
                      onClick={handleRequestOT}
                      disabled={requestOTMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2 rounded-md transition-colors disabled:opacity-60"
                    >
                      {requestOTMutation.isPending ? "Submitting…" : "Submit OT Request"}
                    </button>
                    <button
                      onClick={() => { setShowOTForm(false); setOtReason(""); }}
                      className="px-4 py-2 text-sm border border-input rounded-md text-muted-foreground hover:bg-muted/40 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">No overtime request for today.</p>
                  <button
                    onClick={() => setShowOTForm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-muted/50 border border-input rounded-md text-foreground hover:bg-muted/80 transition-colors"
                  >
                    <Clock className="w-4 h-4" /> Request Overtime
                  </button>
                </div>
              )}
            </div>
          )}

          {todayOT && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {todayOT.status === "unauthorized_ot" && (
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                )}
                {todayOT.status === "ot_completed" && (
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                )}
                <div>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    OT_STATUS_LABELS[todayOT.status]?.color ?? "bg-gray-100 text-gray-600",
                  )}>
                    {OT_STATUS_LABELS[todayOT.status]?.label ?? todayOT.status}
                  </span>
                  {todayOT.otReason && (
                    <p className="text-xs text-muted-foreground mt-1">{todayOT.otReason}</p>
                  )}
                  {todayOT.assignmentSource === "admin_assignment" && (
                    <p className="mt-1 text-xs font-medium text-primary">
                      Assigned schedule: {todayOT.plannedStartTime}–{todayOT.plannedEndTime}
                    </p>
                  )}
                  {todayOT.adminNotes && (
                    <p className="text-xs text-muted-foreground italic mt-0.5">Admin: {todayOT.adminNotes}</p>
                  )}
                  {todayOT.approvedOvertimeHours && (
                    <p className="text-xs text-emerald-700 font-medium mt-0.5">
                      Approved: {parseFloat(todayOT.approvedOvertimeHours).toFixed(2)}h
                    </p>
                  )}
                </div>
              </div>

              {(todayOT.otInTime || todayOT.otOutTime) && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {todayOT.otInTime && (
                    <div>OT In: <span className="text-foreground font-medium">{format(new Date(todayOT.otInTime), "h:mm a")}</span></div>
                  )}
                  {todayOT.otOutTime && (
                    <div>OT Out: <span className="text-foreground font-medium">{format(new Date(todayOT.otOutTime), "h:mm a")}</span></div>
                  )}
                </div>
              )}

              {todayOT.status === "ot_approved" && (
                <button
                  onClick={handleOTClockIn}
                  disabled={otAction === "clockin"}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-md transition-colors disabled:opacity-60"
                >
                  <Clock className="w-4 h-4" />
                  {otAction === "clockin" ? "Recording…" : "Clock OT In"}
                </button>
              )}

              {todayOT.status === "ot_in_progress" && (
                <button
                  onClick={handleOTClockOut}
                  disabled={otAction === "clockout"}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold py-2.5 rounded-md transition-colors disabled:opacity-60"
                >
                  <Clock className="w-4 h-4" />
                  {otAction === "clockout" ? "Recording…" : "Clock OT Out"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
