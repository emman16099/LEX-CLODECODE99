import { useGetMyPayrollHistory, getGetMyPayrollHistoryQueryKey, type PayrollEntry } from "@workspace/api-client-react";
import { Banknote, CheckCircle2, Clock4 } from "lucide-react";

function fmt(v: string | number | null | undefined): string {
  if (v == null) return "—";
  return `₱${parseFloat(String(v))
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

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

function PayBreakdown({ entry, deductions = false }: { entry: PayrollEntry; deductions?: boolean }) {
  const amounts = deductions
    ? [
        ["Late", entry.lateDeductionTotal],
        ["Undertime", entry.undertimeDeductionTotal],
        ["Cash advances", entry.cashAdvanceDeduction],
      ] as const
    : [
        ["Regular pay", entry.regularPay],
        ["Overtime", entry.overtimePay],
        ["Incentive", entry.incentivePay ?? "0"],
      ] as const;
  // Sum in cents for display only; gross and net remain the recorded amounts.
  const total = deductions
    ? amounts.reduce((sum, [, value]) => sum + Math.round(Number(value ?? 0) * 100), 0) / 100
    : entry.grossPay;

  return (
    <dl className="space-y-1 text-sm tabular-nums" data-testid={`breakdown-${deductions ? "deductions" : "earnings"}-${entry.id}`}>
      {amounts.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className={deductions ? "text-destructive" : label === "Incentive" ? "text-emerald-700" : ""}>{fmt(value ?? "0")}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-4 border-t border-card-border pt-1 font-semibold">
        <dt>{deductions ? "Total deductions" : "Gross pay"}</dt>
        <dd>{fmt(total)}</dd>
      </div>
    </dl>
  );
}

export default function EmployeePayrollHistory() {
  const { data: history, isLoading } = useGetMyPayrollHistory({
    query: { queryKey: getGetMyPayrollHistoryQueryKey() },
  });

  const sorted = history
    ? [...history].sort((a, b) =>
        (b.period?.startDate ?? "").localeCompare(a.period?.startDate ?? ""),
      )
    : [];

  return (
    <div className="page-container max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Payroll History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your pay records by period. Net pay is gross pay minus total deductions, with a minimum of ₱0.00.</p>
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Banknote className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">No payroll records yet.</p>
          </div>
        ) : (
          <>
          <div className="divide-y divide-card-border md:hidden">
            {sorted.map(({ entry: e, period: p }) => (
              <article key={e.id} className="p-4 space-y-4" data-testid={`card-payroll-${e.id}`}>
                <header className="space-y-2">
                  <h2 className="text-sm font-semibold">{p ? `${p.startDate} → ${p.endDate}` : "Period unavailable"}</h2>
                  {p ? statusBadge(p.status) : null}
                  <p className="text-xs text-muted-foreground">
                    Present: {e.daysPresent} · Absent: {e.daysAbsent} · Late: {e.lateCount}
                  </p>
                </header>
                <section aria-label="Earnings"><PayBreakdown entry={e} /></section>
                <section aria-label="Deductions"><PayBreakdown entry={e} deductions /></section>
                <dl className="border-t border-card-border pt-3">
                  <div className="flex justify-between gap-4 font-bold tabular-nums">
                    <dt>Net pay</dt>
                    <dd data-testid={`text-mobile-net-pay-${e.id}`}>{fmt(e.netPay)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Payroll by period, with earnings and all deductions in Philippine pesos.</caption>
              <thead>
                <tr className="border-b border-card-border bg-muted/30">
                  {["Period", "Attendance", "Earnings", "Deductions", "Net Pay", "Status"].map((h) => (
                    <th key={h} scope="col" className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {sorted.map(({ entry: e, period: p }) => (
                  <tr key={e.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-payroll-${e.id}`}>
                    <th scope="row" className="px-4 py-3 whitespace-nowrap font-medium text-foreground text-left">
                      {p ? `${p.startDate} → ${p.endDate}` : "—"}
                    </th>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      <div>Present: {e.daysPresent}</div>
                      <div>Absent: {e.daysAbsent}</div>
                      <div>Late: {e.lateCount}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><PayBreakdown entry={e} /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><PayBreakdown entry={e} deductions /></td>
                    <td className="px-4 py-3 whitespace-nowrap font-bold text-foreground" data-testid={`text-net-pay-${e.id}`}>
                      {fmt(e.netPay)}
                    </td>
                    <td className="px-4 py-3">
                      {p ? statusBadge(p.status) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
