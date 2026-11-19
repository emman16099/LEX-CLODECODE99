import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import {
  useCreateCashAdvance,
  useDeleteCashAdvance,
  useListCashAdvances,
  useListEmployees,
  useUpdateCashAdvance,
  getListCashAdvancesQueryKey,
  useGetPayrollPeriod,
  getGetPayrollPeriodQueryKey,
  useIncludePayrollCashAdvance,
  getListPayrollPeriodsQueryKey,
  getGetMyPayrollHistoryQueryKey,
  type CashAdvance,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Banknote, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EditAdvance {
  id: string;
  employeeId: string;
  amount: string;
  advanceDate: string;
  deductionDate: string;
  note: string;
  deducted: boolean;
}

function peso(amount: string | number): string {
  return `₱${Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function advanceStatus(advance: CashAdvance): string {
  if (!advance.deductedPayrollPeriodId) return "Pending";
  if (advance.payrollStatus === "paid") return "Collected through payroll";
  if (advance.payrollStatus === "approved") return "Included in approved payroll";
  if (advance.payrollStatus === "draft") return "Included in draft payroll";
  return "Included in payroll";
}

export default function AdminCashAdvances() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const filterEmployeeId = params.get("employeeId") ?? "";
  const payrollPeriodId = params.get("payrollPeriodId") ?? "";
  const advanceId = params.get("advanceId") ?? "";
  const openedAdvance = useRef("");
  const includeLock = useRef(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [employeeId, setEmployeeId] = useState(filterEmployeeId);
  const [amount, setAmount] = useState("");
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [deductionDate, setDeductionDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<EditAdvance | null>(null);

  const { data: employees = [] } = useListEmployees({ status: "active" });
  const { data: allAdvances = [], isLoading: advancesLoading } = useListCashAdvances({
    query: { queryKey: getListCashAdvancesQueryKey(), refetchOnMount: "always", refetchInterval: 30000 },
  });
  const { data: originPayroll, isLoading: payrollLoading, isError: payrollError } = useGetPayrollPeriod(payrollPeriodId, {
    query: { queryKey: getGetPayrollPeriodQueryKey(payrollPeriodId), enabled: Boolean(payrollPeriodId), refetchInterval: payrollPeriodId ? 30000 : false },
  });
  const isLoading = advancesLoading || (Boolean(payrollPeriodId) && payrollLoading);
  const advances = useMemo(() => {
    if (filterEmployeeId) return allAdvances.filter((advance) => advance.employeeId === filterEmployeeId);
    if (payrollPeriodId) {
      const employeeIds = new Set(originPayroll?.entries.map(({ entry }) => entry.employeeId) ?? []);
      return allAdvances.filter((advance) => employeeIds.has(advance.employeeId));
    }
    return allAdvances;
  }, [allAdvances, filterEmployeeId, payrollPeriodId, originPayroll]);
  const employeeNames = useMemo(
    () => new Map(employees.map((employee) => [
      employee.id,
      `${employee.firstName} ${employee.lastName} (${employee.employeeCode})`,
    ])),
    [employees],
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListCashAdvancesQueryKey() });
  const includeMutation = useIncludePayrollCashAdvance({
    mutation: {
      onSuccess: (payroll) => {
        queryClient.setQueryData(getGetPayrollPeriodQueryKey(payrollPeriodId), payroll);
        void queryClient.invalidateQueries({ queryKey: getListCashAdvancesQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListPayrollPeriodsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetMyPayrollHistoryQueryKey() });
        toast({ title: "Advance included in payroll", description: "Net pay updated. The payroll is Draft; the advance becomes collected when payroll is marked paid." });
      },
      onError: (error: unknown) => {
        const err = error as { data?: { error?: string }; message?: string };
        void invalidate();
        void queryClient.invalidateQueries({ queryKey: getGetPayrollPeriodQueryKey(payrollPeriodId) });
        toast({ title: "Unable to include advance", description: err.data?.error ?? err.message ?? "Please refresh and try again.", variant: "destructive" });
      },
      onSettled: () => { includeLock.current = false; },
    },
  });
  const includeControl = (advance: CashAdvance) => {
    if (!payrollPeriodId || advance.deductedPayrollPeriodId) return null;
    const reason = !originPayroll ? "Payroll unavailable"
      : originPayroll.period.status === "paid" ? "Paid payroll is locked"
      : !originPayroll.entries.some(({ entry }) => entry.employeeId === advance.employeeId) ? "Generate payroll for this employee first"
      : (advance.deductionDate ?? advance.advanceDate) > originPayroll.period.endDate ? "Scheduled after this payroll period"
      : "";
    return <div className="space-y-1">
      <button
        type="button"
        data-testid={`button-include-advance-${advance.id}`}
        disabled={includeMutation.isPending || Boolean(reason)}
        onClick={(event) => {
          if (includeLock.current) return;
          includeLock.current = true;
          event.currentTarget.disabled = true;
          includeMutation.mutate({ id: payrollPeriodId, advanceId: advance.id });
        }}
        className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >{includeMutation.isPending && includeMutation.variables?.advanceId === advance.id ? "Including…" : "Include in this payroll"}</button>
      {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
    </div>;
  };

  const createMutation = useCreateCashAdvance({
    mutation: {
      onSuccess: () => {
        invalidate();
        setAmount("");
        setNote("");
        toast({
          title: "Cash advance recorded",
          description: "Recalculate the employee's draft payroll to apply the deduction.",
        });
      },
      onError: (error: unknown) => {
        const requestError = error as { data?: { error?: string }; message?: string };
        toast({
          title: "Unable to record cash advance",
          description: requestError.data?.error ?? requestError.message ?? "Please try again.",
          variant: "destructive",
        });
      },
    },
  });

  const deleteMutation = useDeleteCashAdvance({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Cash advance deleted" });
      },
      onError: (error: unknown) => {
        const requestError = error as { data?: { error?: string }; message?: string };
        toast({
          title: "Unable to delete cash advance",
          description: requestError.data?.error ?? requestError.message ?? "Please try again.",
          variant: "destructive",
        });
      },
    },
  });

  const updateMutation = useUpdateCashAdvance({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEditing(null);
        toast({ title: "Cash advance updated" });
      },
      onError: (error: unknown) => {
        const requestError = error as { data?: { error?: string }; message?: string };
        toast({
          title: "Unable to update cash advance",
          description: requestError.data?.error ?? requestError.message ?? "Please try again.",
          variant: "destructive",
        });
      },
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!employeeId || !amount || !advanceDate || !deductionDate) return;
    createMutation.mutate({
      data: { employeeId, amount, advanceDate, deductionDate, note: note.trim() || undefined },
    });
  };

  const pending = advances.filter((advance) => !advance.deductedPayrollPeriodId);
  const deducted = advances.filter((advance) => advance.deductedPayrollPeriodId);
  const beginEdit = (advance: (typeof advances)[number]) => setEditing({
    id: advance.id,
    employeeId: advance.employeeId,
    amount: advance.amount,
    advanceDate: advance.advanceDate,
    deductionDate: advance.deductionDate ?? advance.advanceDate,
    note: advance.note ?? "",
    deducted: Boolean(advance.deductedPayrollPeriodId),
  });
  useEffect(() => {
    const advance = advances.find((item) => item.id === advanceId);
    if (advance && openedAdvance.current !== advanceId) {
      openedAdvance.current = advanceId;
      beginEdit(advance);
    }
  }, [advances, advanceId]);
  const deleteAdvance = (advance: (typeof advances)[number]) => {
    const warning = advance.deductedPayrollPeriodId
      ? "Delete this deducted cash advance? Its existing payroll entry will remain unchanged as a historical record."
      : "Delete this pending cash advance?";
    if (window.confirm(warning)) deleteMutation.mutate({ id: advance.id });
  };

  const submitEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    updateMutation.mutate({
      id: editing.id,
      data: {
        employeeId: editing.employeeId,
        amount: editing.amount,
        advanceDate: editing.advanceDate,
        deductionDate: editing.deductionDate,
        note: editing.note.trim() || undefined,
      },
    });
  };

  return (
    <div className="page-container space-y-6">
      {payrollPeriodId && <div className="rounded-lg border border-card-border bg-card p-4 text-sm">
        <Link href={`/admin/payroll/${encodeURIComponent(payrollPeriodId)}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline">← Return to payroll</Link>
        <p className="mt-1 font-semibold">{originPayroll ? `${originPayroll.period.startDate} → ${originPayroll.period.endDate}` : "Loading payroll…"}</p>
        <p className="mt-1 text-muted-foreground">Tap Include in this payroll on a pending advance to update net pay immediately. Included advances become collected only when payroll is marked paid. Editing a record alone still requires recalculation to update an existing deduction.</p>
        {originPayroll?.period.status === "approved" && <p className="mt-2 text-sm text-amber-700">Including an advance returns this approved payroll to Draft. Review and approve it again.</p>}
        {originPayroll?.period.status === "paid" && <p className="mt-2 text-sm font-semibold">This payroll is paid and cannot be changed.</p>}
        {payrollError && <p role="alert" className="mt-2 text-destructive">Unable to load the originating payroll. Return to payroll and reopen Cash Advances.</p>}
      </div>}
      <div>
        <h1 className="text-xl font-bold text-foreground">Cash Advances</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {filterEmployeeId ? `Records for ${employeeNames.get(filterEmployeeId) ?? "the selected employee"}. ` : payrollPeriodId ? "Records for employees in this payroll. " : ""}Select individual advances when recalculating payroll. Each advance can be deducted only once.
        </p>
        {filterEmployeeId && <Link href="/admin/cash-advances" className="inline-flex min-h-11 items-center text-sm text-primary underline">Show all employees</Link>}
      </div>

      <form onSubmit={submit} className="rounded-lg border border-card-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Banknote className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Record cash advance</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</span>
            <select
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName} ({employee.employeeCode})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deduction date</span>
            <input
              type="date"
              value={deductionDate}
              onChange={(event) => setDeductionDate(event.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (PHP)</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="e.g. 1000.00"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Advance date</span>
            <input
              type="date"
              value={advanceDate}
              onChange={(event) => setAdvanceDate(event.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note <span className="normal-case">(optional)</span></span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              placeholder="Reason or reference"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {createMutation.isPending ? "Saving…" : "Record advance"}
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-lg border border-card-border bg-card">
        <div className="border-b border-card-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Advance history</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {pending.length} pending deduction{pending.length === 1 ? "" : "s"} · {deducted.length} already included in payroll
          </p>
        </div>
        <div className="divide-y divide-card-border sm:hidden">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading cash advances…</p>
          ) : advances.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No cash advances recorded.</p>
          ) : advances.map((advance) => (
            <article key={advance.id} className="space-y-3 p-4" data-testid={`cash-advance-card-${advance.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-foreground">{employeeNames.get(advance.employeeId) ?? "Former employee"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Advance {advance.advanceDate}</p>
                  <p className="text-xs text-muted-foreground">Deduction {advance.deductionDate ?? advance.advanceDate}</p>
                </div>
                {advance.deductedPayrollPeriodId ? (
                  <span className="max-w-[10rem] shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">{advanceStatus(advance)}</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">Pending</span>
                )}
              </div>
              <p className="text-lg font-bold text-destructive">−{peso(advance.amount)}</p>
              {advance.note && <p className="break-words text-sm text-muted-foreground">{advance.note}</p>}
              {includeControl(advance)}
              <div className="flex gap-2 border-t border-border pt-3">
                <button type="button" data-testid={`button-edit-cash-advance-${advance.id}`} onClick={() => beginEdit(advance)} className="inline-flex min-h-11 flex-1 touch-manipulation items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground active:bg-primary/80">
                  <Pencil className="h-4 w-4" /> Edit advance
                </button>
                <button type="button" aria-label={`Delete cash advance for ${employeeNames.get(advance.employeeId) ?? "former employee"}`} onClick={() => deleteAdvance(advance)} disabled={deleteMutation.isPending} className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-md border border-input px-3 text-destructive active:bg-destructive/10 disabled:opacity-60">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-card-border bg-muted/30">
                {["Employee", "Advance Date", "Deduction Date", "Amount", "Note", "Payroll Status", "Action"].map((header) => (
                  <th key={header} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {isLoading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">Loading cash advances…</td></tr>
              ) : advances.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">No cash advances recorded.</td></tr>
              ) : advances.map((advance) => (
                <tr key={advance.id} className="hover:bg-muted/20">
                  <td className="px-5 py-3 font-medium text-foreground">{employeeNames.get(advance.employeeId) ?? "Former employee"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{advance.advanceDate}</td>
                  <td className="px-5 py-3 font-medium text-foreground">{advance.deductionDate ?? advance.advanceDate}</td>
                  <td className="px-5 py-3 font-semibold text-destructive">−{peso(advance.amount)}</td>
                  <td className="max-w-xs truncate px-5 py-3 text-muted-foreground">{advance.note || "—"}</td>
                  <td className="px-5 py-3">
                    {advance.deductedPayrollPeriodId ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{advanceStatus(advance)}</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Pending</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {includeControl(advance)}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => beginEdit(advance)}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAdvance(advance)}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="bottom-2 top-2 flex max-h-none max-w-lg translate-y-0 flex-col overflow-hidden sm:bottom-auto sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:-translate-y-1/2">
          <form onSubmit={submitEdit} className="flex min-h-0 flex-1 flex-col gap-4">
            <DialogHeader className="shrink-0">
              <DialogTitle>Edit cash advance</DialogTitle>
              <DialogDescription>
                {editing?.deducted
                  ? "This advance is already deducted. Changes update its record only; the existing payroll remains unchanged."
                  : "Update the cash advance details before it is deducted."}
              </DialogDescription>
            </DialogHeader>
            {editing && (
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto py-2 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</span>
                  <select
                    value={editing.employeeId}
                    onChange={(event) => setEditing({ ...editing, employeeId: event.target.value })}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.firstName} {employee.lastName} ({employee.employeeCode})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (PHP)</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editing.amount}
                    onChange={(event) => setEditing({ ...editing, amount: event.target.value })}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Advance date</span>
                  <input
                    type="date"
                    value={editing.advanceDate}
                    onChange={(event) => setEditing({ ...editing, advanceDate: event.target.value })}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deduction date</span>
                  <input
                    type="date"
                    value={editing.deductionDate}
                    onChange={(event) => setEditing({ ...editing, deductionDate: event.target.value })}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note <span className="normal-case">(optional)</span></span>
                  <input
                    value={editing.note}
                    onChange={(event) => setEditing({ ...editing, note: event.target.value })}
                    maxLength={500}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>
            )}
            <DialogFooter className="shrink-0 gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="min-h-11 w-full rounded-md border border-input px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="min-h-11 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
              >
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}