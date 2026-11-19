import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListPayrollPeriods,
  useCreatePayrollPeriod,
  useListSpecialWorkingDays,
  useCreateSpecialWorkingDay,
  useDeleteSpecialWorkingDay,
  useListEmployees,
  useGeneratePayrollEntries,
  useDeletePayrollPeriod,
  getListPayrollPeriodsQueryKey,
  getListSpecialWorkingDaysQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Banknote,
  Clock4,
  CalendarDays,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

function statusBadge(status: string) {
  if (status === "paid")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
        <Banknote className="w-3 h-3" /> Paid
      </span>
    );
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
        <CheckCircle2 className="w-3 h-3" /> Approved
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      <Clock4 className="w-3 h-3" /> Draft
    </span>
  );
}

function dayOfWeek(dateStr: string) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[new Date(dateStr + "T00:00:00Z").getUTCDay()];
}

export default function AdminPayroll() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // ── Payroll periods ────────────────────────────────────────────────────────
  const { data: periods, isLoading: periodsLoading } = useListPayrollPeriods();
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [employeeScope, setEmployeeScope] = useState<"all" | "selected">("all");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const { data: activeEmployees } = useListEmployees({ status: "active" });

  const createPeriodMutation = useCreatePayrollPeriod();
  const generateMutation = useGeneratePayrollEntries();
  const deletePeriodMutation = useDeletePayrollPeriod();

  async function handleCreatePeriod(ev: React.FormEvent) {
    ev.preventDefault();
    if (!startDate || !endDate) return;
    const employeeIds =
      employeeScope === "all"
        ? (activeEmployees ?? []).map((employee) => employee.id)
        : selectedEmployeeIds;
    if (employeeIds.length === 0) {
      toast({ title: "Select at least one employee", variant: "destructive" });
      return;
    }
    try {
      const period = await createPeriodMutation.mutateAsync({ data: { startDate, endDate } });
      await generateMutation.mutateAsync({
        id: period.id,
        data: { employeeIds, cashAdvanceIds: [] },
      });
      queryClient.invalidateQueries({ queryKey: getListPayrollPeriodsQueryKey() });
      toast({
        title: "Payroll period generated",
        description: employeeScope === "all"
          ? `Included all ${employeeIds.length} active employees.`
          : `Included ${employeeIds.length} selected employee${employeeIds.length === 1 ? "" : "s"}.`,
      });
      setShowPeriodForm(false);
      setStartDate("");
      setEndDate("");
      setEmployeeScope("all");
      setSelectedEmployeeIds([]);
      navigate(`/admin/payroll/${period.id}`);
    } catch (e: unknown) {
      const err = e as { data?: { error?: string }; message?: string };
      toast({ title: err?.data?.error ?? err?.message ?? "Failed to generate payroll period", variant: "destructive" });
    }
  }

  async function handleDeletePeriod(periodId: string, label: string, status: string) {
    const approvedWarning =
      status === "approved"
        ? " This period is approved; deleting it permanently removes the approval and all generated payroll entries."
        : " This removes its generated payroll entries too.";
    if (!window.confirm(`Delete the ${status} payroll period ${label}?${approvedWarning}`)) {
      return;
    }
    try {
      await deletePeriodMutation.mutateAsync({ id: periodId });
      await queryClient.invalidateQueries({ queryKey: getListPayrollPeriodsQueryKey() });
      toast({ title: "Payroll period deleted" });
    } catch (e: unknown) {
      const err = e as { data?: { error?: string }; message?: string };
      toast({ title: err?.data?.error ?? err?.message ?? "Failed to delete payroll period", variant: "destructive" });
    }
  }

  // ── Special working days ───────────────────────────────────────────────────
  const { data: specialDays, isLoading: specialLoading } =
    useListSpecialWorkingDays();
  const [showSpecialForm, setShowSpecialForm] = useState(false);
  const [sDate, setSDate] = useState("");
  const [sReason, setSReason] = useState("");

  const createSpecialMutation = useCreateSpecialWorkingDay({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListSpecialWorkingDaysQueryKey(),
        });
        toast({ title: "Special working day added" });
        setShowSpecialForm(false);
        setSDate("");
        setSReason("");
      },
      onError: (e: unknown) => {
        const err = e as { data?: { error?: string }; message?: string };
        const msg = err?.data?.error ?? err?.message ?? "Failed to add special working day";
        toast({ title: msg, variant: "destructive" });
      },
    },
  });

  const deleteSpecialMutation = useDeleteSpecialWorkingDay({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListSpecialWorkingDaysQueryKey(),
        });
        toast({ title: "Removed" });
      },
      onError: () => {
        toast({ title: "Failed to remove", variant: "destructive" });
      },
    },
  });

  function handleCreateSpecial(ev: React.FormEvent) {
    ev.preventDefault();
    if (!sDate || !sReason.trim()) return;
    createSpecialMutation.mutate({ data: { date: sDate, reason: sReason.trim() } });
  }

  return (
    <div className="page-container max-w-5xl space-y-8">

      {/* ── Payroll Periods ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Payroll Periods</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create weekly periods and generate employee pay summaries
            </p>
          </div>
          <button
            onClick={() => setShowPeriodForm((v) => !v)}
            className="flex shrink-0 items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Period
          </button>
        </div>

        {showPeriodForm && (
          <form
            onSubmit={handleCreatePeriod}
            className="bg-card border border-card-border rounded-lg p-4 sm:p-5 space-y-4"
          >
            <h2 className="text-sm font-semibold text-foreground">New Payroll Period</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Start Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  End Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <fieldset className="space-y-3 rounded-md border border-input p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Employees included
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input p-3">
                  <input
                    type="radio"
                    name="employeeScope"
                    checked={employeeScope === "all"}
                    onChange={() => setEmployeeScope("all")}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">All employees</span>
                    <span className="block text-xs text-muted-foreground">
                      Generate payroll for all active employees
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input p-3">
                  <input
                    type="radio"
                    name="employeeScope"
                    checked={employeeScope === "selected"}
                    onChange={() => setEmployeeScope("selected")}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">Selected employees</span>
                    <span className="block text-xs text-muted-foreground">
                      Choose one employee or several employees
                    </span>
                  </span>
                </label>
              </div>
              {employeeScope === "selected" && (
                <div className="grid max-h-52 gap-2 overflow-y-auto rounded-md bg-muted/30 p-2 sm:grid-cols-2">
                  {(activeEmployees ?? []).map((employee) => {
                    const checked = selectedEmployeeIds.includes(employee.id);
                    return (
                      <label
                        key={employee.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md bg-background px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedEmployeeIds((current) =>
                              checked
                                ? current.filter((id) => id !== employee.id)
                                : [...current, employee.id],
                            )
                          }
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {employee.firstName} {employee.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">{employee.employeeCode}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {employeeScope === "all"
                  ? `${activeEmployees?.length ?? 0} active employee${activeEmployees?.length === 1 ? "" : "s"} will be included.`
                  : `${selectedEmployeeIds.length} employee${selectedEmployeeIds.length === 1 ? "" : "s"} selected.`}
              </p>
            </fieldset>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={createPeriodMutation.isPending || generateMutation.isPending}
                className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {createPeriodMutation.isPending || generateMutation.isPending
                  ? "Creating & generating…"
                  : "Create & Generate Payroll"}
              </button>
              <button
                type="button"
                onClick={() => setShowPeriodForm(false)}
                className="px-4 py-2 text-sm border border-input rounded-md text-foreground hover:bg-muted/40 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          {periodsLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : !periods?.length ? (
            <div className="p-10 text-center space-y-2">
              <Calendar className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">
                No payroll periods yet. Create one to get started.
              </p>
            </div>
          ) : (
            <div className="table-scroll"><table className="min-w-[560px] w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Period</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Generated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {periods.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {p.startDate} → {p.endDate}
                    </td>
                    <td className="px-4 py-3">{statusBadge(p.status)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {p.generatedAt ? (
                        new Date(p.generatedAt).toLocaleDateString()
                      ) : (
                        <span className="text-xs italic">Not generated</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {p.status !== "paid" && (
                          <button
                            type="button"
                            onClick={() => handleDeletePeriod(p.id, `${p.startDate} → ${p.endDate}`, p.status)}
                            disabled={deletePeriodMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        )}
                        <Link href={`/admin/payroll/${p.id}`}>
                          <span className={cn(
                            "inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                            "bg-primary/10 text-primary hover:bg-primary/20",
                          )}>
                            View <ChevronRight className="w-3 h-3" />
                          </span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </section>

      {/* ── Special Working Days ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Special Working Days
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Recorded weekend attendance is always payable. Add weekend dates here
              when employees are expected to work even if no attendance is recorded.
            </p>
          </div>
          <button
            onClick={() => setShowSpecialForm((v) => !v)}
            className="flex shrink-0 items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-semibold bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Date
          </button>
        </div>

        {showSpecialForm && (
          <form
            onSubmit={handleCreateSpecial}
            className="bg-card border border-card-border rounded-lg p-4 sm:p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold text-foreground">Add Special Working Day</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={sDate}
                  onChange={(e) => setSDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Reason <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. DOLE-declared make-up day"
                  value={sReason}
                  onChange={(e) => setSReason(e.target.value)}
                  required
                  maxLength={255}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={createSpecialMutation.isPending}
                className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {createSpecialMutation.isPending ? "Adding…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => setShowSpecialForm(false)}
                className="px-4 py-2 text-sm border border-input rounded-md text-foreground hover:bg-muted/40 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          {specialLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : !specialDays?.length ? (
            <div className="p-8 text-center space-y-1">
              <CalendarDays className="w-7 h-7 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">No special working days defined.</p>
            </div>
          ) : (
            <div className="table-scroll"><table className="min-w-[560px] w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Day</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reason</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {specialDays.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{d.date}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold",
                        ["Sat", "Sun"].includes(dayOfWeek(d.date))
                          ? "bg-orange-100 text-orange-700"
                          : "bg-muted text-muted-foreground",
                      )}>
                        {dayOfWeek(d.date)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.reason}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteSpecialMutation.mutate({ id: d.id })}
                        disabled={deleteSpecialMutation.isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </section>

    </div>
  );
}
