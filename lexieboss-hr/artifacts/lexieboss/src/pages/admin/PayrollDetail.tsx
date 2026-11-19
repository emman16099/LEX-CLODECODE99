import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetPayrollPeriod,
  useGeneratePayrollEntries,
  useApprovePayrollPeriod,
  useMarkPayrollPeriodPaid,
  useListUndertimePending,
  useListEmployees,
  useListCashAdvances,
  getGetPayrollPeriodQueryKey,
  getListPayrollPeriodsQueryKey,
  getListCashAdvancesQueryKey,
  useListAttendanceLogs,
  listAttendanceLogs,
  getListAttendanceLogsQueryKey,
  useCorrectAttendance,
  useRecordManualAttendance,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Banknote,
  Users,
  Clock4,
  AlertTriangle,
  Search,
  Download,
  Pencil,
  Plus,
  History,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IncentiveEditor } from "@/components/payroll/IncentiveEditor";
import { downloadPayslipPdf } from "@/lib/downloadPayslipPdf";
import type { PayslipInput } from "@/lib/downloadPayslipPng";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function fmt(v: string | number | null | undefined): string {
  if (v == null) return "—";
  const n = parseFloat(String(v));
  return `₱${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function localDateTimeInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function statusBadge(status: string) {
  if (status === "paid")
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
        <Banknote className="w-3.5 h-3.5" /> Paid
      </span>
    );
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
        <CheckCircle2 className="w-3.5 h-3.5" /> Approved
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
      <Clock4 className="w-3.5 h-3.5" /> Draft
    </span>
  );
}

export default function AdminPayrollDetail() {
  const [, params] = useRoute("/admin/payroll/:id");
  const id = params?.id ?? "";

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useGetPayrollPeriod(id, {
    query: { queryKey: getGetPayrollPeriodQueryKey(id), enabled: !!id },
  });
  const period = data?.period;
  const entries = data?.entries ?? [];

  const { data: undertimePending } = useListUndertimePending();
  const { data: activeEmployees, isLoading: employeesLoading } = useListEmployees({
    status: "active",
  });
  const { data: cashAdvances, isLoading: cashAdvancesLoading } = useListCashAdvances();
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedCashAdvanceIds, setSelectedCashAdvanceIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [previewEmployeeId, setPreviewEmployeeId] = useState("");
  const [incentiveEmployeeId, setIncentiveEmployeeId] = useState<string | null>(null);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState<"edit" | "add">("edit");
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [attendanceForm, setAttendanceForm] = useState({
    clockInAt: "", clockOutAt: "", dailyRate: "", lateDeduction: "", overtimeHours: "", reason: "",
    employeeId: "", date: "", clockIn: "09:00", clockOut: "18:00",
  });
  const payrollEmployeeIds = new Set(entries.map(({ entry }) => entry.employeeId));
  const pendingUTItems = (undertimePending ?? []).filter(
    (item) =>
      period &&
      item.summary &&
      payrollEmployeeIds.has(item.summary.employeeId) &&
      item.summary.date >= period.startDate &&
      item.summary.date <= period.endDate,
  );
  const pendingUTCount = pendingUTItems.length;

  const attendanceParams = useMemo(
    () => (period ? { from: period.startDate, to: period.endDate } : undefined),
    [period?.startDate, period?.endDate],
  );
  const { data: attendanceLogs, isLoading: attendanceLoading } = useListAttendanceLogs(
    attendanceParams,
    { query: { queryKey: getListAttendanceLogsQueryKey(attendanceParams), enabled: !!attendanceParams } },
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetPayrollPeriodQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListPayrollPeriodsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCashAdvancesQueryKey() });
  };

  const generateMutation = useGeneratePayrollEntries({
    mutation: {
      onSuccess: () => {
        invalidate();
        setSelectionOpen(false);
        toast({ title: "Payroll entries generated" });
      },
      onError: (e: unknown) => {
        const err = e as { data?: { error?: string }; message?: string };
        toast({ title: err?.data?.error ?? err?.message ?? "Generation failed", variant: "destructive" });
      },
    },
  });

  const refreshPayroll = () => {
    const employeeIds = entries.map(({ entry }) => entry.employeeId);
    const cashAdvanceIds = advances.filter((a) => a.deductedPayrollPeriodId === id).map((a) => a.id);
    if (employeeIds.length) generateMutation.mutate({ id, data: { employeeIds, cashAdvanceIds } });
  };
  const correctMutation = useCorrectAttendance({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAttendanceLogsQueryKey(attendanceParams) });
        invalidate();
        refreshPayroll();
        setAttendanceOpen(false);
        toast({ title: "Attendance correction saved", description: "Payroll is being recalculated from the official record." });
      },
      onError: (e: unknown) => {
        const err = e as { data?: { error?: string }; message?: string };
        toast({ title: err?.data?.error ?? err?.message ?? "Correction failed", variant: "destructive" });
      },
    },
  });
  const manualMutation = useRecordManualAttendance();

  const dates = useMemo(() => {
    if (!period) return [];
    const result: string[] = [];
    for (let cursor = new Date(`${period.startDate}T00:00:00Z`); cursor <= new Date(`${period.endDate}T00:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      result.push(cursor.toISOString().slice(0, 10));
    }
    return result;
  }, [period?.startDate, period?.endDate]);
  const includedEmployeeIds = useMemo(() => entries.map(({ entry }) => entry.employeeId), [entries]);
  const logsByKey = useMemo(() => new Map((attendanceLogs ?? []).map((item) => [`${item.log.employeeId}:${item.log.date}`, item])), [attendanceLogs]);
  const openEdit = (item: any) => {
    setAttendanceMode("edit"); setSelectedLog(item);
    setAttendanceForm({
      clockInAt: localDateTimeInput(item.log.clockInAt), clockOutAt: localDateTimeInput(item.log.clockOutAt),
      dailyRate: item.summary?.dailyRateOverride ?? "", lateDeduction: item.summary?.lateDeductionOverride ?? "",
      overtimeHours: item.overtimeHours ?? "", reason: "", employeeId: item.log.employeeId, date: item.log.date, clockIn: "09:00", clockOut: "18:00",
    });
    setAttendanceOpen(true);
  };
  const openAdd = (employeeId: string, date: string) => {
    setAttendanceMode("add"); setSelectedLog(null);
    setAttendanceForm({ clockInAt: "", clockOutAt: "", dailyRate: "", lateDeduction: "", overtimeHours: "", reason: "", employeeId, date, clockIn: "09:00", clockOut: "18:00" });
    setAttendanceOpen(true);
  };
  const saveAttendance = async () => {
    if (!attendanceForm.reason.trim()) {
      toast({ title: "Reason required", description: "Add an audit reason before saving.", variant: "destructive" }); return;
    }
    if (isApproved && !window.confirm("This correction will withdraw payroll approval, return the period to Draft, and recalculate the payslip. You will need to approve it again. Continue?")) return;
    if (attendanceMode === "edit" && selectedLog) {
      correctMutation.mutate({ id: selectedLog.log.id, data: {
        clockInAt: attendanceForm.clockInAt ? new Date(attendanceForm.clockInAt).toISOString() : null,
        clockOutAt: attendanceForm.clockOutAt ? new Date(attendanceForm.clockOutAt).toISOString() : null,
        dailyRate: attendanceForm.dailyRate !== "" ? Number(attendanceForm.dailyRate) : undefined,
        lateDeduction: attendanceForm.lateDeduction !== "" ? Number(attendanceForm.lateDeduction) : undefined,
        overtimeHours: attendanceForm.overtimeHours !== "" ? Number(attendanceForm.overtimeHours) : undefined,
        reason: attendanceForm.reason.trim(),
      } }); return;
    }
    try {
      await manualMutation.mutateAsync({ data: { employeeId: attendanceForm.employeeId, date: attendanceForm.date, action: "clock_in", time: attendanceForm.clockIn, reason: attendanceForm.reason.trim() } });
      await manualMutation.mutateAsync({ data: { employeeId: attendanceForm.employeeId, date: attendanceForm.date, action: "clock_out", time: attendanceForm.clockOut, reason: attendanceForm.reason.trim() } });
      queryClient.invalidateQueries({ queryKey: getListAttendanceLogsQueryKey(attendanceParams) });
      invalidate();
      refreshPayroll(); setAttendanceOpen(false);
      toast({ title: "Attendance added", description: "Payroll is being recalculated from the official record." });
    } catch (e: unknown) {
      const err = e as { data?: { error?: string }; message?: string };
      toast({ title: err?.data?.error ?? err?.message ?? "Attendance save failed", variant: "destructive" });
    }
  };

  const approveMutation = useApprovePayrollPeriod({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Period approved" }); },
      onError: (e: unknown) => {
        const err = e as { data?: { error?: string }; message?: string };
        toast({ title: err?.data?.error ?? err?.message ?? "Approval failed", variant: "destructive" });
      },
    },
  });

  const markPaidMutation = useMarkPayrollPeriodPaid({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Period marked as paid" }); },
      onError: (e: unknown) => {
        const err = e as { data?: { error?: string }; message?: string };
        toast({ title: err?.data?.error ?? err?.message ?? "Failed to mark paid", variant: "destructive" });
      },
    },
  });

  const employees = activeEmployees ?? [];
  const advances = cashAdvances ?? [];
  const filteredEmployees = employees.filter((employee) => {
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return true;
    return `${employee.firstName} ${employee.lastName} ${employee.employeeCode}`
      .toLowerCase()
      .includes(query);
  });
  const allEmployeesSelected =
    employees.length > 0 && selectedEmployeeIds.length === employees.length;
  const isPaid = period?.status === "paid";
  const isApproved = period?.status === "approved";
  const availableCashAdvances = advances.filter(
    (advance) =>
      selectedEmployeeIds.includes(advance.employeeId) &&
      (!advance.deductedPayrollPeriodId || advance.deductedPayrollPeriodId === id) &&
      Boolean(period) &&
      (advance.deductedPayrollPeriodId === id ||
        (advance.deductionDate ?? advance.advanceDate) <= period!.endDate),
  );
  const isLoading2 =
    generateMutation.isPending || approveMutation.isPending || markPaidMutation.isPending;

  const openSelection = () => {
    const activeEmployeeIds = new Set(employees.map((employee) => employee.id));
    const currentEntryIds = entries
      .map(({ entry }) => entry.employeeId)
      .filter((employeeId) => activeEmployeeIds.has(employeeId));
    setSelectedEmployeeIds(
      currentEntryIds.length ? currentEntryIds : employees.map((employee) => employee.id),
    );
    setSelectedCashAdvanceIds(
      advances
        .filter((advance) => advance.deductedPayrollPeriodId === id)
        .map((advance) => advance.id),
    );
    setEmployeeSearch("");
    setSelectionOpen(true);
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployeeIds((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId],
    );
    const employeeIsSelected = selectedEmployeeIds.includes(employeeId);
    if (employeeIsSelected) {
      const employeeAdvanceIds = new Set(
        advances
          .filter((advance) => advance.employeeId === employeeId)
          .map((advance) => advance.id),
      );
      setSelectedCashAdvanceIds((current) =>
        current.filter((advanceId) => !employeeAdvanceIds.has(advanceId)),
      );
    }
  };

  const selectAllEmployees = () => {
    setSelectedEmployeeIds(employees.map((employee) => employee.id));
  };

  const clearEmployeeSelection = () => {
    setSelectedEmployeeIds([]);
    setSelectedCashAdvanceIds([]);
  };

  const toggleCashAdvance = (cashAdvanceId: string) => {
    setSelectedCashAdvanceIds((current) =>
      current.includes(cashAdvanceId)
        ? current.filter((id) => id !== cashAdvanceId)
        : [...current, cashAdvanceId],
    );
  };

  const calculateSelectedPayroll = () => {
    if (selectedEmployeeIds.length === 0) {
      toast({
        title: "Select at least one employee",
        description: "Choose who should be included in this payroll calculation.",
        variant: "destructive",
      });
      return;
    }
    generateMutation.mutate({
      id,
      data: {
        employeeIds: selectedEmployeeIds,
        cashAdvanceIds: selectedCashAdvanceIds.filter((cashAdvanceId) =>
          availableCashAdvances.some((advance) => advance.id === cashAdvanceId),
        ),
      },
    });
  };

  const totals = entries.reduce(
    (acc, { entry: e }) => ({
      regularPay: acc.regularPay + parseFloat(e.regularPay),
      lateDeduction: acc.lateDeduction + parseFloat(e.lateDeductionTotal),
      undertimeDeduction: acc.undertimeDeduction + parseFloat(e.undertimeDeductionTotal ?? "0"),
      cashAdvanceDeduction: acc.cashAdvanceDeduction + parseFloat(e.cashAdvanceDeduction ?? "0"),
      overtimePay: acc.overtimePay + parseFloat(e.overtimePay ?? "0"),
      incentivePay: acc.incentivePay + parseFloat(e.incentivePay ?? "0"),
      grossPay: acc.grossPay + parseFloat(e.grossPay),
      netPay: acc.netPay + parseFloat(e.netPay),
    }),
    { regularPay: 0, lateDeduction: 0, undertimeDeduction: 0, cashAdvanceDeduction: 0, overtimePay: 0, incentivePay: 0, grossPay: 0, netPay: 0 },
  );
  const previewEntry = entries.find(({ entry }) => entry.employeeId === previewEmployeeId) ?? entries[0];
  const previewEmployee = previewEntry?.employee;
  const cashAdvanceLink = (employeeId?: string) => {
    const included = advances.filter((advance) => advance.deductedPayrollPeriodId === id && (!employeeId || advance.employeeId === employeeId));
    return `/admin/cash-advances?payrollPeriodId=${encodeURIComponent(id)}${employeeId ? `&employeeId=${encodeURIComponent(employeeId)}` : ""}${included.length === 1 ? `&advanceId=${encodeURIComponent(included[0].id)}` : ""}`;
  };
  const incentiveEmployee = entries.find(({ entry }) => entry.employeeId === incentiveEmployeeId);
  const downloadPayslip = (employee: PayslipInput["employee"], entry: PayslipInput["entry"]) => {
    if (!period || !attendanceParams) return;
    void (async () => {
      const officialAttendance = await listAttendanceLogs(attendanceParams);
      await downloadPayslipPdf({ employee, period, entry, attendance: officialAttendance });
    })().catch((error: unknown) => {
      toast({ title: "Payslip download failed", description: error instanceof Error ? error.message : "Unable to create PDF.", variant: "destructive" });
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 text-sm text-muted-foreground">Loading period…</div>
    );
  }
  if (!period) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-sm text-destructive">Period not found.</p>
        <Link href="/admin/payroll" className="text-sm text-primary underline mt-2 inline-block">
          Back to Payroll
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <Link
            href="/admin/payroll"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="w-3 h-3" /> All Periods
          </Link>
          <h1 className="text-xl font-bold text-foreground">
            {period.startDate} → {period.endDate}
          </h1>
          <div className="flex items-center gap-3">
            {statusBadge(period.status)}
            {period.generatedAt && (
              <span className="text-xs text-muted-foreground">
                Generated {new Date(period.generatedAt).toLocaleDateString()}
              </span>
            )}
            {period.approvedAt && (
              <span className="text-xs text-muted-foreground">
                Approved {new Date(period.approvedAt).toLocaleDateString()}
              </span>
            )}
            {period.paidAt && (
              <span className="text-xs text-muted-foreground">
                Paid {new Date(period.paidAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isPaid && (
            <button
              disabled={isLoading2}
              onClick={openSelection}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", generateMutation.isPending && "animate-spin")} />
              {period.generatedAt ? "Recalculate" : "Generate"}
            </button>
          )}
          {!isPaid && !isApproved && period.generatedAt && (
            <button
              disabled={isLoading2}
              onClick={() => approveMutation.mutate({ id })}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </button>
          )}
          {!isPaid && isApproved && (
            <button
              disabled={isLoading2}
              onClick={() => markPaidMutation.mutate({ id })}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <Banknote className="w-3.5 h-3.5" /> Mark Paid
            </button>
          )}
        </div>
      </div>

      {/* Pending undertime warning */}
      {period.generatedAt && pendingUTCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 sm:px-5 py-4 flex items-start sm:items-center gap-3 sm:gap-4">
          <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
          <div className="flex-1 text-sm text-orange-800">
            <strong>{pendingUTCount} undertime record{pendingUTCount !== 1 ? "s" : ""}</strong> for the employee{entries.length !== 1 ? "s" : ""} in this payroll {pendingUTCount === 1 ? "is" : "are"} pending review.
            {" "}Dates: {pendingUTItems.map((item) => item.summary!.date).join(", ")}.
            {" "}Checking or correcting a time record does not decide its undertime excuse. Use Approve (Waive) or Reject (Deduct), then recalculate payroll before finalising.
          </div>
          <Link
            href={`/admin/attendance?${new URLSearchParams({ view: "undertime", from: period.startDate, to: period.endDate, employeeIds: entries.map(({ entry }) => entry.employeeId).join(",") })}`}
            className="text-xs font-semibold text-orange-700 hover:text-orange-900 underline underline-offset-2 whitespace-nowrap"
          >
            Review Undertime →
          </Link>
        </div>
      )}

      {/* Totals summary */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {[
            { label: "Employees", value: entries.length.toString(), icon: Users, plain: true },
            { label: "Regular Pay", value: fmt(totals.regularPay) },
            { label: "OT Pay", value: totals.overtimePay > 0 ? fmt(totals.overtimePay) : "—" },
            { label: "Incentives", value: fmt(totals.incentivePay) },
            { label: "Late Deductions", value: totals.lateDeduction > 0 ? `−${fmt(totals.lateDeduction)}` : "—" },
            { label: "Undertime Deductions", value: totals.undertimeDeduction > 0 ? `−${fmt(totals.undertimeDeduction)}` : "—" },
            { label: "Cash Advances", value: totals.cashAdvanceDeduction > 0 ? `−${fmt(totals.cashAdvanceDeduction)}` : "—" },
            { label: "Net Pay", value: fmt(totals.netPay) },
          ].map(({ label, value, icon: Icon, plain }) => (
            <div key={label} className="bg-card border border-card-border rounded-lg p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
              <div className={cn("text-lg font-bold", plain ? "text-foreground" : "text-primary")}>
                {Icon ? (
                  <span className="flex items-center gap-1.5">
                    <Icon className="w-4 h-4 text-muted-foreground" />{value}
                  </span>
                ) : label === "Cash Advances" ? (
                  <Link href={cashAdvanceLink(entries.length === 1 ? entries[0].entry.employeeId : undefined)} className="inline-flex min-h-11 items-center gap-2 underline decoration-dotted underline-offset-4" aria-label="Open cash advance records">{value}<Pencil className="h-3.5 w-3.5" /></Link>
                ) : label === "Incentives" ? (
                  <button type="button" onClick={() => setIncentiveEmployeeId(previewEntry.entry.employeeId)} className="inline-flex min-h-11 items-center gap-2 underline decoration-dotted underline-offset-4" aria-label={isPaid ? "View payroll incentive history" : "Edit payroll incentive"}>{value}{!isPaid && <Pencil className="h-3.5 w-3.5" />}</button>
                ) : value}
              </div>
            </div>
          ))}
        </div>
      )}

      {period.generatedAt && previewEntry && (
        <section className="rounded-xl border border-card-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border bg-[#f7f8fa] px-4 py-3 sm:px-5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Live payslip preview</div>
              <p className="mt-1 text-xs text-muted-foreground">Server-returned values; refreshes after attendance recalculation.</p>
            </div>
            <select data-testid="select-payslip-preview-employee" value={previewEmployee?.id ?? previewEntry.entry.employeeId} onChange={(e) => setPreviewEmployeeId(e.target.value)} className="input min-w-[210px] py-1.5 text-xs">
              {entries.map(({ entry, employee }) => <option key={entry.employeeId} value={entry.employeeId}>{employee ? `${employee.firstName} ${employee.lastName}` : entry.employeeId}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-px bg-card-border sm:grid-cols-4 lg:grid-cols-9">
            {[
              ["Days present", String(previewEntry.entry.daysPresent), "text-foreground"],
              ["Days absent", String(previewEntry.entry.daysAbsent), "text-foreground"],
              ["Regular pay", fmt(previewEntry.entry.regularPay), "text-foreground"],
              ["OT pay", fmt(previewEntry.entry.overtimePay), "text-emerald-700"],
              ["Incentive", fmt(previewEntry.entry.incentivePay ?? "0"), "text-emerald-700"],
              ["Late deduction", `−${fmt(previewEntry.entry.lateDeductionTotal)}`, "text-destructive"],
              ["Undertime deduction", `−${fmt(previewEntry.entry.undertimeDeductionTotal)}`, "text-orange-700"],
              ["Cash advance", `−${fmt(previewEntry.entry.cashAdvanceDeduction)}`, "text-destructive"],
              ["Gross pay", fmt(previewEntry.entry.grossPay), "text-foreground"],
              ["Net pay", fmt(previewEntry.entry.netPay), "text-primary font-bold"],
            ].map(([label, value, color]) => <div key={label} className="bg-card px-3 py-3"><div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div><div className={cn("mt-1 text-sm font-semibold", color)}>
              {label === "Cash advance" ? <Link href={cashAdvanceLink(previewEntry.entry.employeeId)} className="inline-flex min-h-11 items-center gap-1 underline decoration-dotted underline-offset-4" aria-label="Open employee cash advance records">{value}<Pencil className="h-3 w-3" /></Link>
                : label === "Incentive" ? <button type="button" onClick={() => setIncentiveEmployeeId(previewEntry.entry.employeeId)} className="inline-flex min-h-11 items-center gap-1 underline decoration-dotted underline-offset-4" aria-label={isPaid ? "View employee incentive history" : "Edit employee incentive"}>{value}{!isPaid && <Pencil className="h-3 w-3" />}</button>
                : value}
            </div></div>)}
          </div>
          {previewEmployee && <div className="flex items-center justify-between border-t border-card-border px-4 py-2.5 text-xs"><span className="font-semibold">{previewEmployee.firstName} {previewEmployee.lastName} · {previewEmployee.employeeCode}</span><button data-testid={`button-download-preview-payslip-${previewEntry.entry.employeeId}`} type="button" onClick={() => downloadPayslip(previewEmployee, previewEntry.entry)} className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-muted/50"><Download className="h-3.5 w-3.5" />PDF · with ledger</button></div>}
        </section>
      )}

      {/* Official attendance ledger */}
      {period.generatedAt && entries.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-card-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border bg-[#f7f8fa] px-4 py-4 sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold tracking-tight">Official attendance ledger</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Every calendar day is shown. Corrections here feed the next server payroll calculation.</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Present</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Review</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" />No record</span>
            </div>
          </div>
          {attendanceLoading ? (
            <div className="space-y-3 p-5"><div className="h-8 animate-pulse rounded bg-muted" /><div className="h-8 animate-pulse rounded bg-muted" /><div className="h-8 animate-pulse rounded bg-muted" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-xs">
                <thead className="bg-muted/35 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr><th className="sticky left-0 z-10 bg-muted/35 px-4 py-3 text-left">Employee</th>{dates.map((date) => <th key={date} className="min-w-[150px] border-l border-card-border px-3 py-3 text-left">{new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {includedEmployeeIds.map((employeeId) => {
                    const emp = entries.find(({ entry }) => entry.employeeId === employeeId)?.employee;
                    return <tr key={employeeId} className="align-top hover:bg-muted/10">
                      <td className="sticky left-0 z-10 bg-card px-4 py-3">
                        <div className="font-bold text-foreground">{emp ? `${emp.firstName} ${emp.lastName}` : employeeId}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{emp?.employeeCode ?? "Included employee"}</div>
                      </td>
                      {dates.map((date) => {
                        const item = logsByKey.get(`${employeeId}:${date}`);
                        const status = item?.summary?.status;
                        const hasRecord = !!item;
                        return <td key={date} className="border-l border-card-border px-3 py-2.5">
                          <div className="flex min-h-[120px] flex-col justify-between gap-2">
                            <div>
                              <span className={cn("inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", status === "late" ? "status-late" : status === "present" ? "status-present" : hasRecord ? "status-missing_logout" : "bg-slate-100 text-slate-500")}>
                                 {status === "missing_logout" ? "Missing out" : status ?? "No record"}
                              </span>
                              {hasRecord && <div className="mt-1 font-mono text-[10px] text-muted-foreground">{item.log.clockInAt ? new Date(item.log.clockInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} <span className="px-0.5">→</span> {item.log.clockOutAt ? new Date(item.log.clockOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</div>}
                              {hasRecord && <div className="mt-1 space-y-0.5 font-mono text-[10px] leading-tight text-muted-foreground">
                                <div>Rate <b className="text-foreground">{fmt(item.applicableDailyRate)}</b> · Regular <b className="text-foreground">{item.summary?.regularHours ?? "0"}h</b></div>
                                <div>Late <b className="text-amber-700">{item.summary?.lateMinutes ?? 0}m</b> / {fmt(item.summary?.lateDeductionAmount)}</div>
                                <div>UT <b className="text-orange-700">{item.summary?.undertimeMinutes ?? 0}m</b> / {fmt(item.summary?.undertimeDeductionAmount)}</div>
                                <div>OT <b className="text-emerald-700">{item.overtimeHours ?? "0"}h</b></div>
                              </div>}
                            </div>
                            {isPaid ? <span className="text-[10px] text-muted-foreground">Read-only</span> : hasRecord ? <button data-testid={`button-edit-attendance-${item.log.id}`} type="button" onClick={() => openEdit(item)} className="inline-flex w-fit items-center gap-1 text-[10px] font-bold text-primary hover:underline"><Pencil className="h-3 w-3" />Correct</button> : <button data-testid={`button-add-attendance-${employeeId}-${date}`} type="button" onClick={() => openAdd(employeeId, date)} className="inline-flex w-fit items-center gap-1 text-[10px] font-bold text-primary hover:underline"><Plus className="h-3 w-3" />Add attendance</button>}
                            {item?.corrections?.length ? <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><History className="h-3 w-3" />{item.corrections.length} audit change{item.corrections.length === 1 ? "" : "s"}</span> : null}
                          </div>
                        </td>;
                      })}
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Entries table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {!period.generatedAt ? (
          <div className="p-10 text-center space-y-2">
            <RefreshCw className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Click <strong>Generate</strong> to compute payroll entries from attendance records.
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No active employees found for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-muted/30">
                  {["Employee", "Daily Rate", "Days Present", "Days Absent", "Late", "Regular Pay", "OT Pay", "Incentive", "Late Deduction", "Undertime Deduction", "Cash Advance", "Gross Pay", "Net Pay", "Payslip"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {entries.map(({ entry: e, employee: emp }) => {
                  const undertimeDeduction = parseFloat(e.undertimeDeductionTotal ?? "0");
                  return (
                    <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-foreground">
                          {emp ? `${emp.firstName} ${emp.lastName}` : e.employeeId}
                        </div>
                        {emp && (
                          <div className="text-xs text-muted-foreground">{emp.employeeCode}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {fmt(e.dailyRateSnapshot)}
                      </td>
                      <td className="px-4 py-3 font-medium text-center">{e.daysPresent}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{e.daysAbsent}</td>
                      <td className="px-4 py-3 text-center">
                        {e.lateCount > 0 ? (
                          <span className="text-amber-600 font-semibold">{e.lateCount}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmt(e.regularPay)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {parseFloat(e.overtimePay ?? "0") > 0 ? (
                          <span className="text-emerald-700">+{fmt(e.overtimePay)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button type="button" onClick={() => setIncentiveEmployeeId(e.employeeId)} className="inline-flex min-h-11 items-center gap-1 font-semibold text-emerald-700 underline decoration-dotted underline-offset-4" aria-label={`${isPaid ? "View incentive history" : "Edit incentive"} for ${emp?.firstName ?? e.employeeId}`}>{fmt(e.incentivePay ?? "0")}{!isPaid && <Pencil className="h-3 w-3" />}</button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {parseFloat(e.lateDeductionTotal) > 0 ? (
                          <span className="text-destructive">−{fmt(e.lateDeductionTotal)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {undertimeDeduction > 0 ? (
                          <span
                            className="text-orange-700 cursor-help border-b border-dashed border-orange-400"
                            title={`${e.undertimeCount} day(s) · ${e.totalUndertimeMinutes} min total undertime`}
                          >
                            −{fmt(e.undertimeDeductionTotal)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link href={cashAdvanceLink(e.employeeId)} className="inline-flex min-h-11 items-center gap-1 text-destructive underline decoration-dotted underline-offset-4" aria-label={`Open cash advances for ${emp?.firstName ?? e.employeeId}`}>−{fmt(e.cashAdvanceDeduction)}<Pencil className="h-3 w-3" /></Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmt(e.grossPay)}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-bold text-foreground">
                        {fmt(e.netPay)}
                      </td>
                       <td className="px-4 py-3 whitespace-nowrap">
                         {emp ? (
                           <button
                             type="button"
                              onClick={() => downloadPayslip(emp, e)}
                              aria-label={`Download payslip PDF with attendance ledger for ${emp.firstName} ${emp.lastName}`}
                             className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-muted/50"
                           >
                             <Download className="h-3.5 w-3.5" />
                              PDF
                           </button>
                         ) : (
                           <span className="text-muted-foreground">—</span>
                         )}
                       </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-card-border bg-muted/20">
                  <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Totals
                  </td>
                  <td className="px-4 py-3 font-semibold">{fmt(totals.regularPay)}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">
                    {totals.overtimePay > 0 ? `+${fmt(totals.overtimePay)}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">
                    {fmt(totals.incentivePay)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-destructive">
                    {totals.lateDeduction > 0 ? `−${fmt(totals.lateDeduction)}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-orange-700">
                    {totals.undertimeDeduction > 0 ? `−${fmt(totals.undertimeDeduction)}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-destructive">
                    {totals.cashAdvanceDeduction > 0 ? `−${fmt(totals.cashAdvanceDeduction)}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold">{fmt(totals.grossPay)}</td>
                  <td className="px-4 py-3 font-bold text-foreground">{fmt(totals.netPay)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {incentiveEmployee && incentiveEmployeeId && (
        <IncentiveEditor
          key={incentiveEmployeeId}
          periodId={id}
          employeeId={incentiveEmployeeId}
          employeeName={incentiveEmployee.employee ? `${incentiveEmployee.employee.firstName} ${incentiveEmployee.employee.lastName}` : incentiveEmployeeId}
          employees={entries.map(({ entry, employee }) => ({ id: entry.employeeId, name: employee ? `${employee.firstName} ${employee.lastName}` : entry.employeeId }))}
          onEmployeeChange={setIncentiveEmployeeId}
          incentive={data?.incentives?.find((item) => item.employeeId === incentiveEmployeeId)}
          approved={isApproved}
          readOnly={isPaid}
          onClose={() => setIncentiveEmployeeId(null)}
        />
      )}

      <Dialog open={attendanceOpen} onOpenChange={setAttendanceOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{attendanceMode === "edit" ? "Correct official attendance" : "Add attendance record"}</DialogTitle>
            <DialogDescription>{attendanceMode === "edit" ? "Changes are written to the audit trail and payroll is recalculated from the server." : "Both actions are recorded sequentially using Philippine local time."}{isApproved && " Saving will withdraw approval and return this period to Draft. Approve it again after checking the updated payslip."}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {attendanceMode === "edit" ? <>
              <label className="space-y-1 text-xs font-semibold">Clock in<input data-testid="input-correction-clock-in" type="datetime-local" value={attendanceForm.clockInAt} onChange={e => setAttendanceForm(f => ({ ...f, clockInAt: e.target.value }))} className="input w-full" /></label>
              <label className="space-y-1 text-xs font-semibold">Clock out<input data-testid="input-correction-clock-out" type="datetime-local" value={attendanceForm.clockOutAt} onChange={e => setAttendanceForm(f => ({ ...f, clockOutAt: e.target.value }))} className="input w-full" /></label>
              <label className="space-y-1 text-xs font-semibold">Daily rate override<input data-testid="input-correction-daily-rate" type="number" min="0" step="0.01" value={attendanceForm.dailyRate} onChange={e => setAttendanceForm(f => ({ ...f, dailyRate: e.target.value }))} className="input w-full" placeholder="Leave unchanged" /></label>
              <label className="space-y-1 text-xs font-semibold">Late deduction override<input data-testid="input-correction-late-deduction" type="number" min="0" step="0.01" value={attendanceForm.lateDeduction} onChange={e => setAttendanceForm(f => ({ ...f, lateDeduction: e.target.value }))} className="input w-full" placeholder="Leave unchanged" /></label>
              <label className="space-y-1 text-xs font-semibold sm:col-span-2">Approved overtime hours<input data-testid="input-correction-overtime" type="number" min="0" max="24" step="0.01" value={attendanceForm.overtimeHours} onChange={e => setAttendanceForm(f => ({ ...f, overtimeHours: e.target.value }))} className="input w-full" placeholder="Leave unchanged" /></label>
               {selectedLog?.corrections?.length ? <div className="rounded-md border border-card-border bg-muted/25 p-3 text-xs sm:col-span-2"><div className="mb-2 flex items-center gap-1 font-bold"><History className="h-3.5 w-3.5" />Correction history</div>{selectedLog.corrections.map((c: any) => <div key={c.id} className="border-t border-card-border py-2 text-muted-foreground"><span className="font-semibold capitalize text-foreground">{c.field.replace("_", " ")}</span> · {c.previousAmount !== null && c.previousAmount !== undefined ? fmt(c.previousAmount) : c.previousValue ?? "none"} → {c.newAmount !== null && c.newAmount !== undefined ? fmt(c.newAmount) : c.newValue ?? "none"}<div className="mt-0.5">{c.reason} · {c.correctedByName} · {new Date(c.createdAt).toLocaleString()}</div></div>)}</div> : null}
            </> : <>
              <div className="rounded-md bg-muted/35 p-3 text-xs sm:col-span-2"><span className="font-bold">Date</span><div className="mt-1 font-mono">{attendanceForm.date}</div></div>
              <label className="space-y-1 text-xs font-semibold">Clock-in local time<input data-testid="input-manual-clock-in" type="time" value={attendanceForm.clockIn} onChange={e => setAttendanceForm(f => ({ ...f, clockIn: e.target.value }))} className="input w-full" /></label>
              <label className="space-y-1 text-xs font-semibold">Clock-out local time<input data-testid="input-manual-clock-out" type="time" value={attendanceForm.clockOut} onChange={e => setAttendanceForm(f => ({ ...f, clockOut: e.target.value }))} className="input w-full" /></label>
            </>}
            <label className="space-y-1 text-xs font-semibold sm:col-span-2">Required reason<textarea data-testid="input-attendance-reason" value={attendanceForm.reason} onChange={e => setAttendanceForm(f => ({ ...f, reason: e.target.value }))} className="input min-h-[76px] w-full resize-y" placeholder="Explain the fieldwork, exception, or correction" /></label>
          </div>
          <DialogFooter><button data-testid="button-cancel-attendance" type="button" onClick={() => setAttendanceOpen(false)} className="btn-secondary">Cancel</button><button data-testid="button-save-attendance" type="button" onClick={() => void saveAttendance()} disabled={correctMutation.isPending || manualMutation.isPending} className="btn-primary">{correctMutation.isPending || manualMutation.isPending ? "Saving…" : "Save and recalculate"}</button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectionOpen} onOpenChange={setSelectionOpen}>
        <DialogContent className="fixed bottom-2 left-1/2 top-2 flex h-auto max-h-none w-[calc(100vw-1rem)] max-w-2xl -translate-x-1/2 translate-y-0 flex-col overflow-hidden p-4 sm:bottom-auto sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:-translate-y-1/2 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {period.generatedAt ? "Recalculate payroll" : "Generate payroll"}
            </DialogTitle>
            <DialogDescription>
              Select employees and choose the individual cash advances to include.
              Only selected advances will be marked deducted and shown on payslips.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-foreground">
                {selectedEmployeeIds.length} of {employees.length} selected
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <button
                  type="button"
                  onClick={selectAllEmployees}
                  disabled={employees.length === 0 || allEmployeesSelected}
                  className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearEmployeeSelection}
                  disabled={selectedEmployeeIds.length === 0}
                  className="text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
                placeholder="Search by employee name or code"
                aria-label="Search employees"
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="max-h-48 overflow-y-auto rounded-md border border-card-border sm:max-h-72">
              {employeesLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Loading active employees…
                </div>
              ) : employees.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No active employees are available for payroll.
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No employees match your search.
                </div>
              ) : (
                <div className="divide-y divide-card-border">
                  {filteredEmployees.map((employee) => {
                    const selected = selectedEmployeeIds.includes(employee.id);
                    return (
                      <label
                        key={employee.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-3 hover:bg-muted/30"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleEmployee(employee.id)}
                          className="h-4 w-4 rounded border-input accent-primary"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">
                            {employee.firstName} {employee.lastName}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {employee.employeeCode}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-card-border pt-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Cash advances to deduct
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedCashAdvanceIds.length} selected. Unselected advances stay pending.
                </p>
              </div>
              <div className="max-h-36 overflow-y-auto rounded-md border border-card-border sm:max-h-52">
                {cashAdvancesLoading ? (
                  <div className="p-5 text-center text-sm text-muted-foreground">
                    Loading cash advances…
                  </div>
                ) : selectedEmployeeIds.length === 0 ? (
                  <div className="p-5 text-center text-sm text-muted-foreground">
                    Select an employee first.
                  </div>
                ) : availableCashAdvances.length === 0 ? (
                  <div className="p-5 text-center text-sm text-muted-foreground">
                    No scheduled cash advances are available for this payroll period.
                  </div>
                ) : (
                  <div className="divide-y divide-card-border">
                    {availableCashAdvances.map((advance) => {
                      const employee = employees.find(
                        (item) => item.id === advance.employeeId,
                      );
                      return (
                        <label
                          key={advance.id}
                          className="flex cursor-pointer items-center gap-3 px-3 py-3 hover:bg-muted/30"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCashAdvanceIds.includes(advance.id)}
                            onChange={() => toggleCashAdvance(advance.id)}
                            className="h-4 w-4 rounded border-input accent-primary"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground">
                              {employee
                                ? `${employee.firstName} ${employee.lastName}`
                                : "Former employee"}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              Deduct on {advance.deductionDate ?? advance.advanceDate}
                              {advance.note ? ` · ${advance.note}` : ""}
                            </span>
                          </span>
                          <span className="text-sm font-semibold text-destructive">
                            −{fmt(advance.amount)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-card-border bg-background pt-3">
            <button
              type="button"
              onClick={() => setSelectionOpen(false)}
              className="min-h-11 w-full rounded-md border border-input px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/40 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={calculateSelectedPayroll}
              disabled={
                generateMutation.isPending ||
                employeesLoading ||
                selectedEmployeeIds.length === 0
              }
              className="min-h-11 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {generateMutation.isPending
                ? "Calculating…"
                : `Calculate ${selectedEmployeeIds.length} employee${
                    selectedEmployeeIds.length === 1 ? "" : "s"
                  }`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
