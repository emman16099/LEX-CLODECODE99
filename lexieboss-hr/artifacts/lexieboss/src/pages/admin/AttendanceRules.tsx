import { useState } from "react";
import {
  useListAttendanceRules,
  useCreateAttendanceRule,
  useUpdateAttendanceRule,
  useDeleteAttendanceRule,
  getListAttendanceRulesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RuleFormValues {
  name: string;
  shiftStart: string;
  shiftEnd: string;
  lateCutoff: string;
  graceMinutes: number;
  clockOutGraceMinutes: number;
  breakMinutes: number;
  lateDeductionMode: "per_minute" | "fixed_amount" | "none";
  lateDeductionValue: string;
  isActive: boolean;
}

const defaultValues: RuleFormValues = {
  name: "",
  shiftStart: "08:00",
  shiftEnd: "17:00",
  lateCutoff: "08:00",
  graceMinutes: 5,
  clockOutGraceMinutes: 5,
  breakMinutes: 60,
  lateDeductionMode: "per_minute",
  lateDeductionValue: "",
  isActive: true,
};

export default function AdminAttendanceRules() {
  const { data: rules, isLoading } = useListAttendanceRules();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormValues>(defaultValues);

  const createMutation = useCreateAttendanceRule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAttendanceRulesQueryKey() });
        toast({ title: "Rule created" });
        setShowForm(false);
        setForm(defaultValues);
      },
      onError: () => toast({ title: "Failed to create rule", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateAttendanceRule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAttendanceRulesQueryKey() });
        toast({ title: "Rule updated" });
        setEditingId(null);
        setShowForm(false);
        setForm(defaultValues);
      },
      onError: () => toast({ title: "Failed to update rule", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteAttendanceRule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAttendanceRulesQueryKey() });
        toast({ title: "Rule deleted" });
      },
      onError: () => toast({ title: "Failed to delete rule", variant: "destructive" }),
    },
  });

  const handleEdit = (rule: NonNullable<typeof rules>[number]) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      shiftStart: rule.shiftStart,
      shiftEnd: rule.shiftEnd,
      lateCutoff: rule.lateCutoff,
      graceMinutes: rule.graceMinutes,
       clockOutGraceMinutes: rule.clockOutGraceMinutes,
      breakMinutes: rule.breakMinutes,
      lateDeductionMode: rule.lateDeductionMode as RuleFormValues["lateDeductionMode"],
      lateDeductionValue: rule.lateDeductionValue ?? "",
      isActive: rule.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      lateDeductionValue: form.lateDeductionValue || null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="page-container">
      <div className="flex items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Shift Rules</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Define shift schedules, break durations, and late deduction policies</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setForm(defaultValues); setEditingId(null); setShowForm(true); }}
            className="flex shrink-0 items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-3 sm:px-4 py-2.5 rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card border border-card-border rounded-lg p-4 sm:p-5 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-sm text-foreground">{editingId ? "Edit Rule" : "New Rule"}</h2>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); setForm(defaultValues); }}
              aria-label="Close rule form"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Rule Name">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Morning Shift"
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
              <Field label="Grace Minutes">
                <input
                  type="number"
                  min={0}
                  value={form.graceMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, graceMinutes: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
              <Field label="Clock-Out Allowance (minutes)">
                <input
                  type="number"
                  min={0}
                  value={form.clockOutGraceMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, clockOutGraceMinutes: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">No undertime deduction within this window before shift end</p>
              </Field>
              <Field label="Shift Start">
                <input
                  type="time"
                  required
                  value={form.shiftStart}
                  onChange={(e) => setForm((f) => ({ ...f, shiftStart: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
              <Field label="Shift End">
                <input
                  type="time"
                  required
                  value={form.shiftEnd}
                  onChange={(e) => setForm((f) => ({ ...f, shiftEnd: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
              <Field label="Late Cutoff">
                <input
                  type="time"
                  required
                  value={form.lateCutoff}
                  onChange={(e) => setForm((f) => ({ ...f, lateCutoff: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
              <Field label="Break Duration (minutes)">
                <input
                  type="number"
                  min={0}
                  value={form.breakMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, breakMinutes: Number(e.target.value) }))}
                  placeholder="60"
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">Unpaid break subtracted from worked hours</p>
              </Field>
              <Field label="Late Deduction Mode">
                <select
                  value={form.lateDeductionMode}
                  onChange={(e) => setForm((f) => ({ ...f, lateDeductionMode: e.target.value as RuleFormValues["lateDeductionMode"] }))}
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="none">None</option>
                  <option value="per_minute">Per Minute</option>
                  <option value="fixed_amount">Fixed Amount</option>
                </select>
              </Field>
              {form.lateDeductionMode !== "none" && (
                <Field label="Deduction Value (PHP)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.lateDeductionValue}
                    onChange={(e) => setForm((f) => ({ ...f, lateDeductionValue: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Field>
              )}
              <div className="flex items-center gap-2.5 pt-5">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="w-4 h-4 rounded border-input accent-primary"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-foreground">Active</label>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); setForm(defaultValues); }}
                className="px-4 py-2.5 text-sm border border-input rounded-md text-foreground hover:bg-muted/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                <Check className="w-4 h-4" />
                {editingId ? "Save Changes" : "Create Rule"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules list */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="table-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border bg-muted/30">
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Name</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Shift</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Cutoff</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Break</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Deduction</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
              <th className="text-right px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i}>{[...Array(7)].map((_, j) => (
                  <td key={j} className="px-5 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : !rules?.length ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground text-sm">
                  No shift rules yet. Add one to track attendance.
                </td>
              </tr>
            ) : rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3 font-medium text-foreground">{rule.name}</td>
                <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">{rule.shiftStart} – {rule.shiftEnd}</td>
                <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">
                  {rule.lateCutoff} (+{rule.graceMinutes}min arrival)
                  <div className="text-xs text-muted-foreground/80">−{rule.clockOutGraceMinutes}min clock-out</div>
                </td>
                <td className="px-5 py-3 hidden md:table-cell text-muted-foreground">
                  {rule.breakMinutes > 0 ? `${rule.breakMinutes} min` : "—"}
                </td>
                <td className="px-5 py-3 hidden lg:table-cell">
                  {rule.lateDeductionMode === "none" ? (
                    <span className="text-muted-foreground text-xs">None</span>
                  ) : (
                    <span className="text-xs">
                      {rule.lateDeductionMode === "per_minute" ? "Per min" : "Fixed"} ₱{rule.lateDeductionValue ?? 0}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rule.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {rule.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(rule)}
                      aria-label={`Edit ${rule.name}`}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${rule.name}`}
                      disabled={deleteMutation.isPending}
                      onClick={() => { if (confirm(`Delete "${rule.name}"?`)) deleteMutation.mutate({ id: rule.id }); }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:cursor-wait disabled:opacity-60"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
