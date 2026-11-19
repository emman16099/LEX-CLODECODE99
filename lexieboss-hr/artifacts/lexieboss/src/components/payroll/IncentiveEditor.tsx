import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdatePayrollIncentive, getGetPayrollPeriodQueryKey, getListPayrollPeriodsQueryKey,
  getListPayrollIncentiveChangesQueryKey,
  type PayrollIncentive,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { IncentiveHistory } from "./IncentiveHistory";

export function IncentiveEditor({ periodId, employeeId, employeeName, employees, onEmployeeChange, incentive, approved, readOnly = false, onClose }: {
  periodId: string; employeeId: string; employeeName: string;
  employees: { id: string; name: string }[]; onEmployeeChange: (employeeId: string) => void;
  incentive?: PayrollIncentive; approved: boolean; readOnly?: boolean; onClose: () => void;
}) {
  const [amount, setAmount] = useState(incentive?.weeklyAmount ?? "800");
  const [weeks, setWeeks] = useState(String(incentive?.weeks ?? 1));
  const [note, setNote] = useState(incentive?.note ?? "");
  const [error, setError] = useState("");
  const { toast } = useToast();
  const cache = useQueryClient();
  const mutation = useUpdatePayrollIncentive({
    mutation: {
      onSuccess: (result) => {
        cache.setQueryData(getGetPayrollPeriodQueryKey(periodId), result);
        void cache.invalidateQueries({ queryKey: getListPayrollPeriodsQueryKey() });
        void cache.invalidateQueries({ queryKey: getListPayrollIncentiveChangesQueryKey(periodId, employeeId) });
        toast({ title: "Incentive saved", description: "Net pay and payslip updated. This payroll is Draft." });
        onClose();
      },
      onError: (error: unknown) => {
        const err = error as { data?: { error?: string }; message?: string };
        setError(err.data?.error ?? err.message ?? "Unable to save incentive");
      },
    },
  });
  const total = Number(amount) * Number(weeks);
  const save = (remove = false) => {
    if (readOnly || mutation.isPending) return;
    if (!remove && (!/^\d{1,7}(\.\d{1,2})?$/.test(amount) || !Number.isInteger(Number(weeks)) || Number(weeks) < 1 || Number(weeks) > 53 || total > 99999999.99)) {
      setError("Enter a valid amount and 1–53 whole weeks."); return;
    }
    setError("");
    mutation.mutate({ id: periodId, employeeId, data: { weeklyAmount: remove ? "0" : amount, weeks: remove ? 1 : Number(weeks), note: remove ? "" : note.trim() } });
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose(); }}>
      <DialogContent className="bottom-2 top-2 flex max-h-none translate-y-0 flex-col overflow-hidden sm:bottom-auto sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:-translate-y-1/2">
        <DialogHeader className="shrink-0">
          <DialogTitle>{readOnly ? "Incentive history" : "Edit incentive"}</DialogTitle>
          <DialogDescription>{employeeName} · This payroll period only. Recalculation keeps this incentive.</DialogDescription>
        </DialogHeader>
        <form id="payroll-incentive-form" className="min-h-0 flex-1 space-y-4 overflow-y-auto" onSubmit={(event) => { event.preventDefault(); save(); }}>
          {approved && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Saving returns this approved payroll to Draft. Review and approve it again.</p>}
          {employees.length > 1 && <label className="block space-y-1 text-sm font-semibold">Employee
            <select aria-label="Incentive employee" value={employeeId} disabled={mutation.isPending} onChange={(event) => onEmployeeChange(event.target.value)} className="input w-full">
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </label>}
          {readOnly && <p className="text-sm text-muted-foreground">Paid payroll is read-only.</p>}
          <fieldset disabled={readOnly || mutation.isPending} className="space-y-4">
          <label className="block space-y-1 text-sm font-semibold">Weekly incentive (₱)
            <input aria-label="Weekly incentive" type="number" inputMode="decimal" min="0" max="9999999.99" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="input w-full" />
          </label>
          <label className="block space-y-1 text-sm font-semibold">Number of weeks
            <input aria-label="Number of weeks" type="number" inputMode="numeric" min="1" max="53" step="1" required value={weeks} onChange={(e) => setWeeks(e.target.value)} className="input w-full" />
          </label>
          <p className="rounded-md bg-muted p-3 text-sm font-semibold">Total incentive: ₱{Number.isFinite(total) ? total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</p>
          <label className="block space-y-1 text-sm font-semibold">Note (optional)
            <textarea aria-label="Incentive note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="input min-h-20 w-full" />
          </label>
          <p className="text-xs text-muted-foreground">Enter 800 and 2 weeks for a ₱1,600 incentive. This does not automatically repeat in future payroll periods.</p>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {!readOnly && incentive && Number(incentive.weeklyAmount) > 0 && <button type="button" disabled={mutation.isPending} onClick={() => save(true)} className="min-h-11 text-sm font-semibold text-destructive underline">Remove incentive</button>}
          <IncentiveHistory periodId={periodId} employeeId={employeeId} />
        </form>
        <DialogFooter className="shrink-0 gap-2 border-t pt-3">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="btn-secondary min-h-11">{readOnly ? "Close" : "Cancel"}</button>
          {!readOnly && <button type="submit" form="payroll-incentive-form" disabled={mutation.isPending} className="btn-primary min-h-11">{mutation.isPending ? "Saving…" : "Save incentive"}</button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
